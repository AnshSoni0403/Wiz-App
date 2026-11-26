import { Link } from "react-router-dom";
import Icon from "../Icon";
import RunProgress, { StatusPill } from "./RunProgress";
import useResearchRun from "../../hooks/useResearchRun";
import { isActiveRun, MODE_LABELS, RUN_STATUS } from "../../utils/research";
import "../../styles/research.css";

/**
 * Research started from chat (assistant message `research` field). Follows the run live and,
 * once the report is ready, links to it inside the app (router Link, not a new tab).
 */
const ResearchJobCard = ({ research }) => {
    const seed = research.runId
        ? { id: research.runId, status: research.status, reportId: research.reportId, title: research.title, mode: research.mode }
        : null;
    const { run, error, retry } = useResearchRun(research.runId, seed, { fetchFirst: true });
    const status = run?.status || research.status;
    const reportId = run?.reportId || research.reportId;
    const title = research.title || run?.title || "Research";
    const mode = MODE_LABELS[research.mode || run?.mode];
    const active = isActiveRun(status);
    // Without a run to follow, a report id alone is enough to link.
    const canOpen = Boolean(reportId) && (status === "ready" || !research.runId);

    return (
        <section className="research-job" aria-label={`Research: ${title}`}>
            <div className="research-job__head">
                <span className="research-job__icon">
                    <Icon name="research" size={20} />
                </span>
                <div className="research-job__titles">
                    <strong>{title}</strong>
                    {mode ? <span>{mode}</span> : null}
                </div>
                <span aria-live="polite" aria-atomic="true">
                    <span className="sr-only">Research status: </span>
                    <StatusPill status={status} />
                </span>
            </div>
            {active || status === "failed" || error ? <RunProgress run={run} error={error} onRetry={retry} /> : null}
            {active ? (
                <p className="research-job__hint">This usually takes a few minutes. You can keep chatting.</p>
            ) : null}
            {canOpen ? (
                <Link className="btn btn--secondary btn--sm research-job__open" to={`/research/${encodeURIComponent(reportId)}`}>
                    <Icon name="research" size={16} /> Open report
                </Link>
            ) : null}
            {status === "ready" && !reportId ? (
                <p className="research-job__hint">
                    The report is saved. Find it in the <Link to="/research">Research tab</Link>.
                </p>
            ) : null}
            {status === "cancelled" ? <p className="research-job__hint">This research was cancelled.</p> : null}
            {status && !RUN_STATUS[status] && !reportId ? (
                <p className="research-job__hint">
                    Follow it in the <Link to="/research">Research tab</Link>.
                </p>
            ) : null}
        </section>
    );
};

export default ResearchJobCard;
