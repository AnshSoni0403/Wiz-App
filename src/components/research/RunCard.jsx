import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon";
import RunProgress, { StatusPill } from "./RunProgress";
import useResearchRun from "../../hooks/useResearchRun";
import { branchName, relativeTime } from "../../utils/format";
import { isActiveRun, MODE_LABELS } from "../../utils/research";

const TRIGGER_LABELS = { manual: "Started by hand", schedule: "Scheduled", chat: "From chat", telegram: "From Telegram", refresh: "Refresh" };

/**
 * A run in progress (or just finished) with live status. Calls `onSettled(run)` once when a run
 * that was working finishes, so the page can reload its reports.
 */
const RunCard = ({ run: seed, branches = [], currentReportId = null, onSettled = null }) => {
    const { run, error, retry } = useResearchRun(seed?.id, seed);
    const status = run?.status;
    const settledRef = useRef(!isActiveRun(seed?.status));
    const onSettledRef = useRef(onSettled);
    onSettledRef.current = onSettled;

    useEffect(() => {
        if (settledRef.current || !status || isActiveRun(status)) return;
        settledRef.current = true;
        onSettledRef.current?.(run);
    }, [status, run]);

    const meta = [
        MODE_LABELS[run?.mode],
        run?.branch ? branchName(run.branch, branches) : "",
        TRIGGER_LABELS[run?.trigger],
        relativeTime(run?.finishedAt || run?.startedAt || run?.createdAt),
    ].filter(Boolean);
    const reportId = typeof run?.reportId === "string" ? run.reportId : null;

    return (
        <li className="research-run">
            <div className="research-run__head">
                <Icon name="research" size={20} />
                <div className="research-run__titles">
                    <strong>{run?.title || "Research"}</strong>
                    {meta.length ? <span>{meta.join(" · ")}</span> : null}
                </div>
                <span aria-live="polite" aria-atomic="true">
                    <span className="sr-only">Status: </span>
                    <StatusPill status={status} />
                </span>
            </div>
            <RunProgress run={run} error={error} onRetry={retry} />
            {status === "ready" && reportId && reportId !== currentReportId ? (
                <Link className="btn btn--secondary btn--sm" to={`/research/${encodeURIComponent(reportId)}`}>
                    Open report
                </Link>
            ) : null}
        </li>
    );
};

export default RunCard;
