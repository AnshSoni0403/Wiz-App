import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import TopBar from "../../components/TopBar";
import RunCard from "../../components/research/RunCard";
import { StatusPill } from "../../components/research/RunProgress";
import { getResearchOverview, listResearchReports } from "../../api/research.api";
import { useAuth } from "../../context/AuthContext";
import { friendlyMessage, toApiError } from "../../utils/errors";
import { branchName, relativeTime } from "../../utils/format";
import { DEPTH_LABELS, isActiveRun, list, MODE_LABELS, textList } from "../../utils/research";
import NewResearchSheet from "./NewResearchSheet";
import ReportDetail from "./ReportDetail";
import "../../styles/research.css";

const PAGE_SIZE = 20;
const MODE_FILTERS = [
    ["", "All"],
    ["competitor", "Competitors"],
    ["general", "General"],
];
const FREQUENCY_LABELS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

const count = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const ReportCard = ({ report, branches }) => {
    const schedule = report.schedule && typeof report.schedule === "object" ? report.schedule : null;
    const repeating = FREQUENCY_LABELS[schedule?.frequency];
    const updating = isActiveRun(report.latestRun?.status);
    const actionable = count(report.actionableCount);
    const facts = [
        plural(count(report.sourceCount), "source"),
        plural(count(report.findingCount), "finding"),
        actionable ? `${actionable} to review` : "",
        relativeTime(report.updatedAt || report.createdAt),
    ].filter(Boolean);
    return (
        <li>
            <Link className="research-report" to={`/research/${encodeURIComponent(report.id)}`}>
                <span className="research-report__title">{report.title || "Untitled research"}</span>
                <span className="research-badges">
                    <StatusPill status={report.status} kind="report" />
                    {MODE_LABELS[report.mode] ? <span className="research-tag">{MODE_LABELS[report.mode]}</span> : null}
                    {report.branch ? <span className="research-tag">{branchName(report.branch, branches)}</span> : null}
                    {report.depth === "deep" ? <span className="research-tag">{DEPTH_LABELS.deep}</span> : null}
                    {repeating ? (
                        <span className="research-tag">
                            {repeating}
                            {schedule.paused ? " (paused)" : ""}
                        </span>
                    ) : null}
                    {report.partial ? <span className="research-tag research-tag--low">Partial</span> : null}
                    {updating ? <span className="research-tag research-tag--new">Updating</span> : null}
                </span>
                {report.summary ? <span className="research-report__summary">{report.summary}</span> : null}
                <span className="research-report__meta">{facts.join(" · ")}</span>
            </Link>
        </li>
    );
};

/** Report list, live runs and the "New research" sheet. */
const ResearchHome = ({ wizz, branches }) => {
    const [overview, setOverview] = useState(null);
    const [overviewError, setOverviewError] = useState(null);
    const [reports, setReports] = useState(null); // { items, total, page }
    const [listError, setListError] = useState(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [mode, setMode] = useState("");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [followed, setFollowed] = useState([]);
    const [sheetOpen, setSheetOpen] = useState(false);
    const newButtonRef = useRef(null);

    const follow = useCallback((runs) => {
        const fresh = list(runs).filter((run) => run && typeof run.id === "string");
        if (!fresh.length) return;
        setFollowed((current) => [...fresh.filter((run) => !current.some((item) => item.id === run.id)), ...current]);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        getResearchOverview(controller.signal)
            .then((data) => {
                setOverview(data && typeof data === "object" ? data : {});
                setOverviewError(null);
                follow(list(data?.activeRuns).filter((run) => isActiveRun(run?.status)));
            })
            .catch((err) => {
                if (toApiError(err).kind !== "cancelled") setOverviewError(err);
            });
        return () => controller.abort();
    }, [reloadKey, follow]);

    useEffect(() => {
        const controller = new AbortController();
        setLoadingList(true);
        const params = { page: 1, pageSize: PAGE_SIZE };
        if (mode) params.mode = mode;
        if (query) params.q = query;
        listResearchReports(params, controller.signal)
            .then((data) => {
                setReports({ items: list(data?.items), total: count(data?.total), page: count(data?.page) || 1 });
                setListError(null);
            })
            .catch((err) => {
                if (toApiError(err).kind !== "cancelled") setListError(err);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingList(false);
            });
        return () => controller.abort();
    }, [mode, query, reloadKey]);

    const reload = useCallback(() => setReloadKey((value) => value + 1), []);

    const loadMore = async () => {
        if (loadingMore || !reports) return;
        setLoadingMore(true);
        try {
            const params = { page: reports.page + 1, pageSize: PAGE_SIZE };
            if (mode) params.mode = mode;
            if (query) params.q = query;
            const data = await listResearchReports(params);
            setReports((current) => {
                const items = current?.items || [];
                const more = list(data?.items).filter((item) => !items.some((existing) => existing.id === item.id));
                return { items: [...items, ...more], total: count(data?.total), page: count(data?.page) || params.page };
            });
            setListError(null);
        } catch (err) {
            setListError(err);
        } finally {
            setLoadingMore(false);
        }
    };

    const closeSheet = useCallback(() => {
        setSheetOpen(false);
        // Return focus to the button that opened the sheet.
        window.setTimeout(() => newButtonRef.current?.focus(), 0);
    }, []);

    const onCreated = useCallback(
        (run) => {
            if (run) follow([run]);
            reload();
        },
        [follow, reload]
    );

    const permissions = overview?.permissions && typeof overview.permissions === "object" ? overview.permissions : {};
    const createBranches = textList(permissions.createBranches);
    const canCreate = permissions.canCreate !== false && createBranches.length > 0;
    const stats = overview?.stats && typeof overview.stats === "object" ? overview.stats : null;
    const filtered = Boolean(mode || query);
    const items = reports?.items || [];

    return (
        <div className="research-content">
            <section className="research-hero">
                <Icon name="research" size={31} />
                <h1>Research</h1>
                <p>Competitor analysis, market questions and server sizing, written up as dated reports with every claim linked to its source.</p>
                {canCreate ? (
                    <button ref={newButtonRef} type="button" className="btn btn--primary" onClick={() => setSheetOpen(true)}>
                        <Icon name="plus" size={18} /> New research
                    </button>
                ) : overview ? (
                    <p className="research-muted">
                        You can read research shared with your branches. To start research, ask Wizz in chat or ask your admin for access.
                    </p>
                ) : null}
                {stats ? (
                    <dl className="research-stats">
                        <div>
                            <dt>Reports</dt>
                            <dd>{count(stats.reports)}</dd>
                        </div>
                        <div>
                            <dt>Running</dt>
                            <dd>{count(stats.running)}</dd>
                        </div>
                        <div>
                            <dt>To review</dt>
                            <dd>{count(stats.actionable)}</dd>
                        </div>
                    </dl>
                ) : null}
            </section>

            {overview?.provider?.prototype ? (
                <p className="research-note research-note--info">
                    <Icon name="info" size={14} /> Web search uses the free prototype provider, so coverage may be thinner than a paid search
                    service. Reports say when a source couldn't be read.
                </p>
            ) : null}
            {overviewError ? (
                <p className="research-alert" role="alert">
                    Couldn't load research status: {friendlyMessage(overviewError)}{" "}
                    <button type="button" className="link-btn" onClick={reload}>
                        Try again
                    </button>
                </p>
            ) : null}

            {followed.length ? (
                <section aria-labelledby="research-runs-title">
                    <h2 id="research-runs-title" className="research-list-title">
                        In progress
                    </h2>
                    <ul className="research-runs">
                        {followed.map((run) => (
                            <RunCard key={run.id} run={run} branches={branches} onSettled={reload} />
                        ))}
                    </ul>
                </section>
            ) : null}

            <section aria-labelledby="research-reports-title">
                <h2 id="research-reports-title" className="research-list-title">
                    Reports
                </h2>
                <div className="research-filters">
                    <div className="research-segment" role="group" aria-label="Filter by type">
                        {MODE_FILTERS.map(([value, label]) => (
                            <button key={value || "all"} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <form
                        className="research-search"
                        role="search"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setQuery(search.trim());
                        }}
                    >
                        <label htmlFor="research-search" className="sr-only">
                            Search reports
                        </label>
                        <input
                            id="research-search"
                            type="search"
                            value={search}
                            maxLength={200}
                            placeholder="Search reports"
                            onChange={(event) => {
                                setSearch(event.target.value);
                                if (!event.target.value) setQuery("");
                            }}
                        />
                        <button type="submit" className="btn btn--secondary btn--sm">
                            Search
                        </button>
                    </form>
                </div>

                <div aria-live="polite" aria-busy={loadingList}>
                    {listError ? (
                        <p className="research-alert" role="alert">
                            {friendlyMessage(listError)}{" "}
                            <button type="button" className="link-btn" onClick={reload}>
                                Try again
                            </button>
                        </p>
                    ) : null}
                    {!reports && loadingList ? (
                        <p className="research-status" role="status">
                            Loading reports…
                        </p>
                    ) : null}
                    {reports && !items.length && !loadingList ? (
                        filtered ? (
                            <div className="research-empty">
                                <p>No reports match these filters.</p>
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => {
                                        setMode("");
                                        setSearch("");
                                        setQuery("");
                                    }}
                                >
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <div className="research-empty">
                                <p>No research yet.</p>
                                <p className="research-muted">
                                    {canCreate ? "Start one with New research, or ask " : "Ask "}
                                    Wizz in chat, for example “Research the top five video analytics competitors in Kenya”.
                                </p>
                                <Link className="btn btn--ghost btn--sm" to="/knowledge">
                                    Ask Wizz
                                </Link>
                            </div>
                        )
                    ) : null}
                </div>
                {items.length ? (
                    <ul className="research-reports">
                        {items.map((report) => (
                            <ReportCard key={report.id} report={report} branches={branches} />
                        ))}
                    </ul>
                ) : null}
                {reports && items.length < reports.total ? (
                    <div className="research-actions research-actions--center">
                        <button type="button" className="btn btn--ghost" onClick={loadMore} disabled={loadingMore}>
                            {loadingMore ? "Loading…" : `Show more (${reports.total - items.length} left)`}
                        </button>
                    </div>
                ) : null}
            </section>

            {canCreate ? (
                <NewResearchSheet
                    open={sheetOpen}
                    onClose={closeSheet}
                    onCreated={onCreated}
                    createBranches={createBranches}
                    defaultBranch={wizz?.member?.homeBranch}
                    branches={branches}
                />
            ) : null}
        </div>
    );
};

/**
 * Research Agent (route /research and /research/:reportId).
 * Reading reports and following runs; editing, approval and schedules live in the Admin.
 */
const ResearchPage = () => {
    const { reportId } = useParams();
    const { wizz } = useAuth();
    const branches = list(wizz?.branches);
    const scrollRef = useRef(null);

    // Opening another report should start at its top, not where the list was scrolled.
    useEffect(() => {
        scrollRef.current?.scrollTo?.({ top: 0 });
    }, [reportId]);

    return (
        <div className="page research-page">
            <TopBar title="Wizz" subtitle="Research" />
            <div className="research-scroll" ref={scrollRef}>
                {reportId ? (
                    <ReportDetail key={reportId} reportId={reportId} branches={branches} />
                ) : (
                    <ResearchHome wizz={wizz} branches={branches} />
                )}
            </div>
        </div>
    );
};

export default ResearchPage;
