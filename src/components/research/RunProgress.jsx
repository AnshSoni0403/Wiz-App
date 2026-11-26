import { friendlyMessage } from "../../utils/errors";
import { clampPercent, isActiveRun, REPORT_STATUS, RUN_STATUS, STAGE_LABELS } from "../../utils/research";

/** Coloured status label for a run (`kind="run"`) or a report (`kind="report"`). */
export const StatusPill = ({ status, kind = "run" }) => {
    const known = (kind === "report" ? REPORT_STATUS : RUN_STATUS)[status];
    if (!known && !status) return null;
    const { label, tone } = known || { label: status, tone: "muted" };
    return <span className={`research-pill research-pill--${tone}`}>{label}</span>;
};

/**
 * Progress for one run: bar + stage while it works, the error once it failed, and a note when the
 * live status could not be refreshed. The status itself is announced by the caller's live region.
 */
const RunProgress = ({ run, error = null, onRetry = null }) => {
    const status = run?.status;
    const active = isActiveRun(status);
    const progress = run?.progress && typeof run.progress === "object" ? run.progress : {};
    const percent = clampPercent(progress.percent);
    const stage = STAGE_LABELS[progress.stage] || (typeof progress.stage === "string" ? progress.stage : "");
    const message = typeof progress.message === "string" ? progress.message : "";
    const counts = run?.counts && typeof run.counts === "object" ? run.counts : null;
    const fetched = Number(counts?.fetched) || 0;
    const failed = Number(counts?.failedSources) || 0;

    return (
        <div className="research-progress">
            {active ? (
                <div
                    className={`research-bar${percent === null ? " research-bar--indeterminate" : ""}`}
                    role="progressbar"
                    aria-label="Research progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent ?? undefined}
                    aria-valuetext={percent === null ? stage || "Working" : `${percent}%${stage ? `, ${stage}` : ""}`}
                >
                    <span style={percent === null ? undefined : { width: `${Math.max(percent, 4)}%` }} />
                </div>
            ) : null}
            {active && (stage || message) ? (
                <p className="research-progress__text">{[stage, message].filter(Boolean).join(" · ")}</p>
            ) : null}
            {fetched || failed ? (
                <p className="research-progress__counts">
                    {fetched} {fetched === 1 ? "source" : "sources"} read
                    {failed ? ` · ${failed} could not be read` : ""}
                </p>
            ) : null}
            {status === "failed" ? (
                <p className="research-progress__error">{run?.error || "The research could not be completed."}</p>
            ) : null}
            {error ? (
                <p className="research-progress__warn">
                    Couldn't update the progress: {friendlyMessage(error)}{" "}
                    {onRetry ? (
                        <button type="button" className="link-btn" onClick={onRetry}>
                            Try again
                        </button>
                    ) : null}
                </p>
            ) : null}
        </div>
    );
};

export default RunProgress;
