/**
 * Research Agent labels and small helpers shared by the Research tab and the chat job card.
 * Values follow the shared contract (ResearchRun.status, ResearchReport.status, job mode/depth).
 */

export const ACTIVE_RUN_STATUSES = Object.freeze(["queued", "researching", "drafting"]);

export const isActiveRun = (status) => ACTIVE_RUN_STATUSES.includes(status);

export const RUN_STATUS = Object.freeze({
    queued: { label: "Queued", tone: "info" },
    researching: { label: "Researching", tone: "info" },
    drafting: { label: "Drafting report", tone: "info" },
    ready: { label: "Ready", tone: "success" },
    failed: { label: "Failed", tone: "danger" },
    cancelled: { label: "Cancelled", tone: "muted" },
});

export const REPORT_STATUS = Object.freeze({
    draft: { label: "Draft", tone: "warning" },
    approved: { label: "Approved", tone: "success" },
    archived: { label: "Archived", tone: "muted" },
});

export const MODE_LABELS = Object.freeze({ competitor: "Competitor analysis", general: "General research" });
export const DEPTH_LABELS = Object.freeze({ brief: "Brief", deep: "Deep" });

/** Pipeline stages (ResearchRun.progress.stage) in plain words. */
export const STAGE_LABELS = Object.freeze({
    queued: "Waiting for a research worker",
    planning: "Planning searches",
    searching: "Searching the web",
    fetching: "Reading sources",
    extracting: "Pulling out facts",
    comparing: "Comparing findings",
    drafting: "Writing the report",
});

/** 0-100, or null when the server gave no usable number (shown as an indeterminate bar). */
export const clampPercent = (value) => {
    const n = Number(value);
    if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return null;
    return Math.min(100, Math.max(0, Math.round(n)));
};

/**
 * The URL when it is a plain http(s) link, otherwise null. Source URLs come from the open web,
 * so anything else (javascript:, data:, relative paths) is never turned into a link.
 */
export const httpUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch {
        return null;
    }
};

/** Host name for display ("www.example.com" -> "example.com"). */
export const hostOf = (value) => {
    const href = httpUrl(value);
    if (!href) return "";
    return new URL(href).hostname.replace(/^www\./, "");
};

/** Only arrays survive; everything else becomes []. Server content is model output, so be defensive. */
export const list = (value) => (Array.isArray(value) ? value : []);

/** Non-empty trimmed strings from a list. */
export const textList = (value) => list(value).filter((item) => typeof item === "string" && item.trim());

/** `research` summary on a chat message, or null when absent / unusable. */
export const normaliseChatResearch = (value) => {
    if (!value || typeof value !== "object") return null;
    const runId = typeof value.runId === "string" && value.runId ? value.runId : null;
    const reportId = typeof value.reportId === "string" && value.reportId ? value.reportId : null;
    if (!runId && !reportId) return null;
    return {
        jobId: typeof value.jobId === "string" ? value.jobId : null,
        runId,
        reportId,
        status: typeof value.status === "string" ? value.status : "",
        title: typeof value.title === "string" ? value.title : "",
        mode: typeof value.mode === "string" ? value.mode : "",
    };
};
