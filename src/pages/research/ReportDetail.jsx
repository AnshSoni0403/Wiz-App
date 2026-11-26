import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import Markdown from "../../components/Markdown";
import RunCard from "../../components/research/RunCard";
import { StatusPill } from "../../components/research/RunProgress";
import { getResearchReport, refreshResearchReport } from "../../api/research.api";
import { friendlyMessage, isRetryable, toApiError } from "../../utils/errors";
import { branchName, formatDate, relativeTime } from "../../utils/format";
import { DEPTH_LABELS, hostOf, httpUrl, isActiveRun, list, MODE_LABELS, textList } from "../../utils/research";

const text = (value) => (typeof value === "string" ? value.trim() : "");
const plain = (value) => (typeof value === "string" || typeof value === "number" ? String(value) : "");

const CHANGE_LABELS = { new: "New", changed: "Changed", unchanged: "Unchanged" };
const CONFIDENCE_LABELS = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };
const SIZING_LABELS = {
    cameras: ["Cameras", ""],
    resolution: ["Resolution", ""],
    analysisFps: ["Analysis FPS", ""],
    modelsPerCamera: ["Detections per camera", ""],
    concurrencyPercent: ["Concurrency", "%"],
    retentionDays: ["Retention", " days"],
    codec: ["Codec", ""],
    topology: ["Topology", ""],
    sites: ["Sites", ""],
    growthPercent: ["Growth allowance", "%"],
    headroomPercent: ["Headroom", "%"],
};

/** Tooltip text for a source chip: publisher and dates. */
const sourceTip = (source) => {
    if (!source) return "Source not listed in this report";
    const published = formatDate(source.publishedAt);
    const observed = formatDate(source.observedAt);
    return [
        text(source.title),
        text(source.publisher) || hostOf(source.url),
        published ? `Published ${published}` : "Publish date not stated",
        observed ? `Checked ${observed}` : "",
    ]
        .filter(Boolean)
        .join(" · ");
};

/** Citation chips beside a claim. Each opens its source in a new tab. */
const SourceChips = ({ ids, sources }) => {
    const unique = [...new Set(textList(ids))];
    if (!unique.length) return null;
    return (
        <span className="research-chips">
            {unique.map((sourceId) => {
                const source = sources.get(sourceId);
                const href = httpUrl(source?.url);
                const failed = source?.status === "failed";
                const className = `research-chip${source?.kind === "knowledge" ? " research-chip--kb" : ""}${failed ? " research-chip--failed" : ""}`;
                const tip = sourceTip(source);
                return href ? (
                    <a
                        key={sourceId}
                        className={className}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={tip}
                        aria-label={`Source ${sourceId}: ${tip} (opens in a new tab)`}
                    >
                        {sourceId}
                    </a>
                ) : (
                    <span key={sourceId} className={className} title={tip} aria-label={`Source ${sourceId}: ${tip}`}>
                        {sourceId}
                    </span>
                );
            })}
        </span>
    );
};

const Section = ({ title, children, className = "" }) => (
    <section className={`research-card ${className}`.trim()}>
        <h2>{title}</h2>
        {children}
    </section>
);

const BulletList = ({ items }) => {
    const rows = textList(items);
    return rows.length ? (
        <ul className="research-bullets">
            {rows.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    ) : null;
};

/** Sideways-scrolling wrapper for wide tables; focusable so keyboard users can scroll it. */
const TableScroll = ({ label, children }) => (
    <div className="research-table-wrap" role="region" aria-label={`${label} (scrolls sideways)`} tabIndex={0}>
        {children}
    </div>
);

const Findings = ({ findings, sources }) => (
    <ol className="research-findings">
        {findings.map((finding, index) => {
            const isFact = finding.kind === "fact";
            const meta = [text(finding.entity), text(finding.category)].filter(Boolean);
            return (
                <li key={text(finding.id) || index} className="research-finding">
                    <div className="research-finding__tags">
                        <span className={`research-kind research-kind--${isFact ? "fact" : "interpretation"}`}>
                            {isFact ? "Fact" : "Interpretation"}
                        </span>
                        {finding.isNew === true ? <span className="research-tag research-tag--new">New</span> : null}
                        {CONFIDENCE_LABELS[finding.confidence] ? (
                            <span className={`research-tag research-tag--${finding.confidence}`}>
                                {CONFIDENCE_LABELS[finding.confidence]}
                            </span>
                        ) : null}
                        {meta.length ? <span className="research-finding__meta">{meta.join(" · ")}</span> : null}
                    </div>
                    <p className="research-finding__text">
                        {text(finding.statement)} <SourceChips ids={finding.sourceIds} sources={sources} />
                    </p>
                    {text(finding.evidence) ? <blockquote className="research-quote">“{text(finding.evidence)}”</blockquote> : null}
                    {finding.unverifiedQuote ? (
                        <p className="research-note research-note--warn">
                            <Icon name="alert" size={14} /> This quote could not be matched in the source. Check it before relying on it.
                        </p>
                    ) : null}
                </li>
            );
        })}
    </ol>
);

const Changes = ({ changes, sources }) => (
    <ul className="research-changes">
        {changes.map((change, index) => {
            const since = formatDate(change.baselineDate);
            return (
                <li key={index} className={`research-change research-change--${CHANGE_LABELS[change.type] ? change.type : "unchanged"}`}>
                    <span className="research-tag">{CHANGE_LABELS[change.type] || "Noted"}</span>
                    <div>
                        {text(change.entity) ? <strong>{text(change.entity)}</strong> : null}
                        <p>
                            {text(change.summary)} <SourceChips ids={change.sourceIds} sources={sources} />
                        </p>
                        {since ? <span className="research-muted">Compared with {since}</span> : null}
                    </div>
                </li>
            );
        })}
    </ul>
);

const Comparison = ({ comparison, sources }) => {
    const columns = textList(comparison.columns);
    const rows = list(comparison.rows).filter((row) => row && typeof row === "object");
    if (!columns.length || !rows.length) return null;
    const title = text(comparison.title) || "Comparison";
    return (
        <Section title={title}>
            <TableScroll label={title}>
                <table className="research-table">
                    <thead>
                        <tr>
                            <th scope="col">
                                <span className="sr-only">Item</span>
                            </th>
                            {columns.map((column, index) => (
                                <th key={index} scope="col">
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                <th scope="row">{text(row.label)}</th>
                                {columns.map((_, cellIndex) => {
                                    const cell = list(row.cells)[cellIndex];
                                    const unknown = !cell || cell.status === "unknown" || !text(cell.text);
                                    return (
                                        <td key={cellIndex}>
                                            {unknown ? (
                                                <span className="research-unknown">Unknown</span>
                                            ) : (
                                                <>
                                                    {text(cell.text)}
                                                    {cell.status === "claim" ? <span className="research-claim"> (their claim)</span> : null}{" "}
                                                    <SourceChips ids={cell.sourceIds} sources={sources} />
                                                </>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableScroll>
            <p className="research-muted">“Unknown” means no source confirmed it. “Their claim” is what the company says about itself.</p>
        </Section>
    );
};

const Components = ({ label, components, sources }) => {
    const rows = list(components).filter((row) => row && typeof row === "object");
    if (!rows.length) return null;
    return (
        <TableScroll label={label}>
            <table className="research-table">
                <thead>
                    <tr>
                        <th scope="col">Part</th>
                        <th scope="col">Specification</th>
                        <th scope="col">Why</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>
                            <th scope="row">{text(row.part)}</th>
                            <td>{text(row.spec)}</td>
                            <td>
                                {text(row.reason)} <SourceChips ids={row.sourceIds} sources={sources} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </TableScroll>
    );
};

const Configuration = ({ configuration, sources }) => {
    const inputs = configuration.inputs && typeof configuration.inputs === "object" ? configuration.inputs : {};
    const inputRows = Object.entries(inputs).filter(([, value]) => plain(value));
    const calculations = list(configuration.calculations).filter((row) => row && typeof row === "object");
    const recommended = configuration.recommended && typeof configuration.recommended === "object" ? configuration.recommended : null;
    const alternatives = list(configuration.alternatives).filter((row) => row && typeof row === "object");
    return (
        <Section title="Server configuration" className="research-config">
            <p className="research-note research-note--info">
                <Icon name="info" size={14} /> Sizing figures are estimates from the inputs below. Confirm them with a benchmark before quoting.
            </p>
            {inputRows.length ? (
                <>
                    <h3>Inputs</h3>
                    <dl className="research-inputs">
                        {inputRows.map(([key, value]) => {
                            const [label, unit] = SIZING_LABELS[key] || [key, ""];
                            return (
                                <div key={key}>
                                    <dt>{label}</dt>
                                    <dd>
                                        {plain(value)}
                                        {unit}
                                    </dd>
                                </div>
                            );
                        })}
                    </dl>
                </>
            ) : null}
            {textList(configuration.assumptions).length ? (
                <>
                    <h3>Assumptions</h3>
                    <BulletList items={configuration.assumptions} />
                </>
            ) : null}
            {calculations.length ? (
                <>
                    <h3>Calculations</h3>
                    <TableScroll label="Calculations">
                        <table className="research-table">
                            <thead>
                                <tr>
                                    <th scope="col">Calculation</th>
                                    <th scope="col">Formula</th>
                                    <th scope="col">Result</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calculations.map((row, index) => (
                                    <tr key={index}>
                                        <th scope="row">
                                            {text(row.label)}
                                            {row.kind === "estimate" && !/estimate/i.test(text(row.label)) ? (
                                                <span className="research-tag research-tag--low"> estimate</span>
                                            ) : null}
                                        </th>
                                        <td>
                                            <code>{text(row.formula)}</code>
                                        </td>
                                        <td className="research-num">{[plain(row.value), text(row.unit)].filter(Boolean).join(" ")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableScroll>
                </>
            ) : null}
            {recommended ? (
                <div className="research-option research-option--recommended">
                    <h3>Recommended: {text(recommended.title) || "configuration"}</h3>
                    {text(recommended.summary) ? <Markdown text={recommended.summary} /> : null}
                    <Components label="Recommended components" components={recommended.components} sources={sources} />
                </div>
            ) : null}
            {alternatives.map((option, index) => (
                <div key={index} className="research-option">
                    <h3>Alternative: {text(option.title) || `option ${index + 1}`}</h3>
                    {text(option.summary) ? <Markdown text={option.summary} /> : null}
                    <Components label={`Alternative ${index + 1} components`} components={option.components} sources={sources} />
                    {textList(option.tradeoffs).length ? (
                        <>
                            <h4>Trade-offs</h4>
                            <BulletList items={option.tradeoffs} />
                        </>
                    ) : null}
                </div>
            ))}
            {textList(configuration.benchmarksNeeded).length ? (
                <>
                    <h3>Benchmarks still needed</h3>
                    <BulletList items={configuration.benchmarksNeeded} />
                </>
            ) : null}
            {text(configuration.measuredVsEstimated) ? (
                <p className="research-muted">
                    <strong>Measured vs estimated:</strong> {text(configuration.measuredVsEstimated)}
                </p>
            ) : null}
        </Section>
    );
};

const Sources = ({ sources }) => (
    <ol className="research-sources">
        {sources.map((source, index) => {
            const href = httpUrl(source.url);
            const published = formatDate(source.publishedAt);
            const observed = formatDate(source.observedAt);
            const name = text(source.title) || hostOf(source.url) || text(source.url) || "Untitled source";
            const failed = source.status === "failed";
            return (
                <li key={text(source.id) || index} className={failed ? "is-failed" : undefined}>
                    <span className="research-chip" aria-hidden="true">
                        {text(source.id) || index + 1}
                    </span>
                    <div>
                        {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                                {name}
                                <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                        ) : (
                            <strong>{name}</strong>
                        )}
                        <span className="research-muted">
                            {[
                                source.kind === "knowledge" ? "Marwiz knowledge base" : text(source.publisher) || hostOf(source.url),
                                published ? `Published ${published}` : source.kind === "knowledge" ? "" : "Publish date not stated",
                                observed ? `Checked ${observed}` : "",
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </span>
                        {failed ? (
                            <span className="research-source__error">Couldn't be read{text(source.error) ? `: ${text(source.error)}` : ""}</span>
                        ) : null}
                    </div>
                </li>
            );
        })}
    </ol>
);

/** Asks before re-running: a refresh spends search and AI budget and saves a new dated report. */
const RefreshAction = ({ reportId, depth: currentDepth, onStarted }) => {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState("");
    const busyRef = useRef(false);
    const promptRef = useRef(null);

    useEffect(() => {
        if (confirming) promptRef.current?.focus();
    }, [confirming]);

    const start = async (depth) => {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setProblem("");
        try {
            const data = await refreshResearchReport(reportId, depth ? { depth } : {});
            setConfirming(false);
            onStarted(data?.run || null);
        } catch (error) {
            setProblem(friendlyMessage(error));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    };

    if (!confirming) {
        return (
            <button type="button" className="btn btn--secondary" onClick={() => setConfirming(true)}>
                <Icon name="refresh" size={18} /> Refresh research
            </button>
        );
    }
    return (
        <div className="research-confirm">
            <p ref={promptRef} tabIndex={-1}>
                Run this research again? Wizz searches and reads the sources again and saves a new dated report. This report stays as it is.
            </p>
            {problem ? (
                <p className="research-alert" role="alert">
                    {problem}
                </p>
            ) : null}
            <div className="research-actions">
                <button type="button" className="btn btn--primary" disabled={busy} onClick={() => start(null)}>
                    {busy ? "Starting…" : "Refresh"}
                </button>
                {currentDepth !== "deep" ? (
                    <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => start("deep")}>
                        Refresh in depth
                    </button>
                ) : null}
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setConfirming(false)}>
                    Cancel
                </button>
            </div>
        </div>
    );
};

/**
 * One research report (GET /wizz/research/reports/:id): header, notices, sections in the order of
 * the report content, sources, and runs still working on it.
 */
const ReportDetail = ({ reportId, branches }) => {
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);
    const [followed, setFollowed] = useState([]);

    const follow = useCallback((runs) => {
        const fresh = list(runs).filter((run) => run && typeof run.id === "string");
        if (!fresh.length) return;
        setFollowed((current) => [...fresh.filter((run) => !current.some((item) => item.id === run.id)), ...current]);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        getResearchReport(reportId, controller.signal)
            .then((data) => {
                if (!data || typeof data !== "object") throw new Error("Empty report");
                setReport(data);
                setError(null);
                follow(list(data.runs).filter((run) => isActiveRun(run?.status)));
            })
            .catch((err) => {
                if (toApiError(err).kind !== "cancelled") setError(err);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [reportId, reloadKey, follow]);

    const reload = useCallback(() => setReloadKey((value) => value + 1), []);

    const sources = useMemo(() => list(report?.sources).filter((source) => source && typeof source === "object"), [report]);
    const sourceMap = useMemo(() => new Map(sources.map((source) => [text(source.id), source])), [sources]);

    if (!report) {
        return (
            <div className="research-content" aria-busy={loading}>
                <Link to="/research" className="research-back">
                    ‹ All research
                </Link>
                {loading ? (
                    <p className="research-status" role="status">
                        Loading report…
                    </p>
                ) : (
                    <section className="research-card" role="alert">
                        <h1>Report unavailable</h1>
                        <p>{friendlyMessage(error)}</p>
                        <div className="research-actions">
                            {isRetryable(error) ? (
                                <button type="button" className="btn btn--secondary" onClick={reload}>
                                    Try again
                                </button>
                            ) : null}
                            <Link className="btn btn--ghost" to="/research">
                                Back to research
                            </Link>
                        </div>
                    </section>
                )}
            </div>
        );
    }

    const content = report.content && typeof report.content === "object" ? report.content : {};
    const meta = content.meta && typeof content.meta === "object" ? content.meta : {};
    const findings = list(content.findings).filter((item) => item && typeof item === "object" && text(item.statement));
    const changes = Array.isArray(content.changes) ? content.changes.filter((item) => item && typeof item === "object") : [];
    const comparison = content.comparison && typeof content.comparison === "object" ? content.comparison : null;
    const configuration = content.configuration && typeof content.configuration === "object" ? content.configuration : null;
    const recommendation = content.recommendation && typeof content.recommendation === "object" ? content.recommendation : {};
    const failures = list(report.failures).filter((item) => item && typeof item === "object");
    const adminUrl = httpUrl(report.links?.admin);
    const proposedHandoffs = list(report.handoffs).filter((item) => item?.status === "proposed").length;
    const baseline = report.baseline && typeof report.baseline === "object" ? report.baseline : null;
    const hasBody =
        text(content.executiveSummary) || findings.length || comparison || configuration || text(content.interpretation);
    const created = formatDate(report.createdAt);

    return (
        <div className="research-content" aria-busy={loading}>
            <Link to="/research" className="research-back">
                ‹ All research
            </Link>
            <header className="research-heading">
                <h1>{text(report.title) || "Untitled research"}</h1>
                <div className="research-badges">
                    <StatusPill status={report.status} kind="report" />
                    {MODE_LABELS[report.mode] ? <span className="research-tag">{MODE_LABELS[report.mode]}</span> : null}
                    {report.branch ? <span className="research-tag">{branchName(report.branch, branches)}</span> : null}
                    {DEPTH_LABELS[report.depth] ? <span className="research-tag">{DEPTH_LABELS[report.depth]}</span> : null}
                    {Number(report.version) > 1 ? <span className="research-tag">Version {report.version}</span> : null}
                    {report.partial ? <span className="research-tag research-tag--low">Partial</span> : null}
                </div>
                <p className="research-muted">
                    {[
                        created ? `Researched ${created}` : "",
                        text(report.createdBy?.name) ? `Requested by ${text(report.createdBy.name)}` : "",
                        relativeTime(report.updatedAt) ? `Updated ${relativeTime(report.updatedAt)}` : "",
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
                {text(report.question) ? (
                    <p className="research-question">
                        <span>Question</span>
                        {text(report.question)}
                    </p>
                ) : null}
            </header>

            <div className="research-actions research-actions--top">
                {report.canEdit !== false ? <RefreshAction reportId={reportId} depth={report.depth} onStarted={(run) => (run ? follow([run]) : reload())} /> : null}
                <button type="button" className="btn btn--ghost" onClick={reload} disabled={loading}>
                    {loading ? "Reloading…" : "Reload"}
                </button>
                {adminUrl ? (
                    <a className="btn btn--ghost" href={adminUrl} target="_blank" rel="noopener noreferrer">
                        Open full report in Admin <Icon name="external" size={16} />
                    </a>
                ) : null}
            </div>
            {error ? (
                <p className="research-alert" role="alert">
                    Couldn't reload: {friendlyMessage(error)}
                </p>
            ) : null}

            {followed.length ? (
                <section className="research-card" aria-label="Research runs">
                    <h2>Updating this research</h2>
                    <ul className="research-runs">
                        {followed.map((run) => (
                            <RunCard key={run.id} run={run} branches={branches} currentReportId={reportId} onSettled={reload} />
                        ))}
                    </ul>
                </section>
            ) : null}

            {meta.prototypeProvider ? (
                <p className="research-note research-note--info">
                    <Icon name="info" size={14} /> Found with the free prototype search provider, so coverage may be thinner than a paid
                    search service.
                </p>
            ) : null}
            {meta.noExternalSources ? (
                <p className="research-note research-note--info">
                    <Icon name="info" size={14} /> No external sources: this answer comes from the sizing calculation and approved Marwiz
                    knowledge only.
                </p>
            ) : null}
            {report.partial || failures.length ? (
                <div className="research-note research-note--warn research-partial">
                    <Icon name="alert" size={16} />
                    <div>
                        <strong>Partial result.</strong> Some sources couldn't be read, so this report may miss information.
                        {failures.length ? (
                            <details>
                                <summary>
                                    {failures.length} {failures.length === 1 ? "source" : "sources"} not read
                                </summary>
                                <ul>
                                    {failures.map((failure, index) => (
                                        <li key={index}>
                                            {hostOf(failure.url) || text(failure.url) || "Unknown source"}
                                            {text(failure.reason) ? ` — ${text(failure.reason)}` : ""}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ) : null}
                    </div>
                </div>
            ) : null}
            {baseline && (text(baseline.title) || baseline.date) ? (
                <p className="research-muted">
                    Changes are compared with {baseline.id ? <Link to={`/research/${encodeURIComponent(baseline.id)}`}>{text(baseline.title) || "the previous report"}</Link> : text(baseline.title)}
                    {formatDate(baseline.date) ? ` (${formatDate(baseline.date)})` : ""}.
                </p>
            ) : null}

            {!hasBody ? (
                <section className="research-card">
                    <h2>No findings yet</h2>
                    <p>This report has no content to show. Refresh the research or open it in the Admin for details.</p>
                </section>
            ) : null}

            {text(content.executiveSummary) ? (
                <Section title="Summary">
                    <Markdown text={content.executiveSummary} />
                </Section>
            ) : null}

            {changes.length ? (
                <Section title="Changes since last report">
                    <Changes changes={changes} sources={sourceMap} />
                </Section>
            ) : null}

            {findings.length ? (
                <Section title="Key findings">
                    <p className="research-muted">
                        <strong>Fact</strong> = stated by a cited source. <strong>Interpretation</strong> = Wizz's reading. Tap a source number
                        to open it.
                    </p>
                    <Findings findings={findings} sources={sourceMap} />
                </Section>
            ) : null}

            {comparison ? <Comparison comparison={comparison} sources={sourceMap} /> : null}
            {configuration ? <Configuration configuration={configuration} sources={sourceMap} /> : null}

            {textList(content.assumptions).length || textList(content.unknowns).length ? (
                <Section title="Assumptions and unknowns">
                    {textList(content.assumptions).length ? (
                        <>
                            <h3>Assumptions</h3>
                            <BulletList items={content.assumptions} />
                        </>
                    ) : null}
                    {textList(content.unknowns).length ? (
                        <>
                            <h3>Still unknown</h3>
                            <BulletList items={content.unknowns} />
                        </>
                    ) : null}
                </Section>
            ) : null}

            {text(content.interpretation) ? (
                <Section title="Interpretation" className="research-interpretation">
                    <p className="research-muted">Wizz's own reading of the findings, not a sourced fact.</p>
                    <Markdown text={content.interpretation} />
                </Section>
            ) : null}

            {text(recommendation.summary) || textList(recommendation.tradeoffs).length ? (
                <Section title="Recommendation">
                    {text(recommendation.summary) ? <Markdown text={recommendation.summary} /> : null}
                    {textList(recommendation.tradeoffs).length ? (
                        <>
                            <h3>Trade-offs</h3>
                            <BulletList items={recommendation.tradeoffs} />
                        </>
                    ) : null}
                </Section>
            ) : null}

            {textList(content.nextActions).length ? (
                <Section title="Next actions">
                    <BulletList items={content.nextActions} />
                </Section>
            ) : null}

            {proposedHandoffs ? (
                <p className="research-note research-note--info">
                    <Icon name="info" size={14} /> {proposedHandoffs} suggested follow-up{proposedHandoffs === 1 ? "" : "s"} (leads, tasks or
                    knowledge drafts) {proposedHandoffs === 1 ? "is" : "are"} waiting for review in the Admin.
                </p>
            ) : null}

            {sources.length ? (
                <Section title={`Sources (${sources.length})`}>
                    <Sources sources={sources} />
                </Section>
            ) : null}

            {adminUrl ? (
                <div className="research-actions research-actions--end">
                    <a className="btn btn--primary" href={adminUrl} target="_blank" rel="noopener noreferrer">
                        Open full report in Admin <Icon name="external" size={16} />
                    </a>
                </div>
            ) : null}
        </div>
    );
};

export default ReportDetail;
