import { useEffect } from "react";
import useResearchRun from "../../hooks/useResearchRun";
import { friendlyMessage } from "../../utils/errors";
import { clampPercent, isActiveRun, STAGE_LABELS } from "../../utils/research";

/**
 * Quiet progress line under a chat reply while Wizz researches the question on the web.
 * The answer itself arrives as a new message in the same conversation; `onFinished` tells the
 * chat to fetch it once the run is done. `settled` is what the chat already knows about a run
 * that finished: `{ status, phase: "loading" | "missing" }`.
 */
const ResearchStatus = ({ research, settled = null, onFinished, onShowAnswer }) => {
    const { run, error, stopped } = useResearchRun(research.runId, settled?.status || research.status);
    const status = settled?.status || run?.status || research.status;
    const active = isActiveRun(status);

    useEffect(() => {
        if (!settled && status && !isActiveRun(status)) onFinished(research, status);
    }, [settled, status, research, onFinished]);

    let line;
    let detail = null;
    if (active && stopped) {
        line =
            error?.status === 404
                ? "This research is no longer available."
                : `Couldn't check on this research. ${friendlyMessage(error)}`;
    } else if (active) {
        const progress = run?.progress && typeof run.progress === "object" ? run.progress : {};
        const stage = STAGE_LABELS[progress.stage] || (status === "drafting" ? STAGE_LABELS.drafting : "");
        line = `Researching…${stage ? ` ${stage}` : ""}`;
        detail = error
            ? "Having trouble checking progress. Still trying…"
            : "This can take a few minutes. You can keep chatting.";
    } else if (settled?.phase !== "missing") {
        line = "Research done. Getting the answer…";
    } else if (status === "failed") {
        line = "Sorry, I couldn't finish this research. Try asking again in a moment.";
    } else if (status === "cancelled") {
        line = "This research was stopped.";
    } else {
        line = "Research done, but the answer hasn't shown up yet.";
    }

    const percent = clampPercent(run?.progress?.percent);
    const showBar = active && !stopped;
    const canShowAnswer = !active && settled?.phase === "missing" && status === "ready";

    return (
        <div className="research-status">
            <p className="research-status__line" aria-live="polite" aria-atomic="true">
                {line}
            </p>
            {showBar ? (
                <div
                    className={`research-status__bar${percent === null ? " is-indeterminate" : ""}`}
                    role="progressbar"
                    aria-label="Research progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent ?? undefined}
                >
                    <span style={percent === null ? undefined : { width: `${Math.max(percent, 4)}%` }} />
                </div>
            ) : null}
            {detail ? <p className="research-status__hint">{detail}</p> : null}
            {canShowAnswer ? (
                <button type="button" className="link-btn research-status__action" onClick={onShowAnswer}>
                    Check again
                </button>
            ) : null}
        </div>
    );
};

export default ResearchStatus;
