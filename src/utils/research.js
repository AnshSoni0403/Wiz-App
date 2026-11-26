/**
 * Small helpers for research started from chat. Values follow the shared contract
 * (ResearchRun.status / progress.stage); labels are plain words, no product jargon.
 */

export const ACTIVE_RUN_STATUSES = Object.freeze(["queued", "researching", "drafting"]);

export const isActiveRun = (status) => ACTIVE_RUN_STATUSES.includes(status);

/** ResearchRun.progress.stage in plain words, shown as "Researching… <stage>". */
export const STAGE_LABELS = Object.freeze({
    queued: "getting started",
    planning: "working out what to look for",
    searching: "searching the web",
    fetching: "reading sources",
    extracting: "pulling out the facts",
    comparing: "comparing what I found",
    drafting: "writing the answer",
});

/** 0-100, or null when the server gave no usable number (shown as an indeterminate bar). */
export const clampPercent = (value) => {
    const n = Number(value);
    if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return null;
    return Math.min(100, Math.max(0, Math.round(n)));
};

const idOrNull = (value) => (typeof value === "string" && value ? value : null);

/** `research` on a chat message - `{ jobId, runId, reportId, status, title }` - or null when absent / unusable. */
export const normaliseChatResearch = (value) => {
    if (!value || typeof value !== "object") return null;
    const research = {
        jobId: idOrNull(value.jobId),
        runId: idOrNull(value.runId),
        reportId: idOrNull(value.reportId),
        status: typeof value.status === "string" ? value.status : "",
        title: typeof value.title === "string" ? value.title : "",
    };
    return research.jobId || research.runId || research.reportId ? research : null;
};

/**
 * Keys ("run:<id>", "job:<id>") of the research that already has its answer in `messages`:
 * the server posts a new assistant message whose `research.status` is no longer active.
 */
export const answeredResearch = (messages) => {
    const keys = new Set();
    for (const m of messages) {
        const r = m.role === "assistant" ? m.research : null;
        if (!r || isActiveRun(r.status)) continue;
        if (r.runId) keys.add(`run:${r.runId}`);
        if (r.jobId) keys.add(`job:${r.jobId}`);
    }
    return keys;
};

export const isAnswered = (research, answered) =>
    Boolean(research) &&
    ((research.runId && answered.has(`run:${research.runId}`)) || (research.jobId && answered.has(`job:${research.jobId}`)));
