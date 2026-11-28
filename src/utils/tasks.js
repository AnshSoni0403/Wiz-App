/**
 * Display helpers for tasks. Labels follow the shared contract; the server's statusLabel wins when present.
 */
export const STATUS_LABELS = {
    pending: "Assigned",
    accepted: "Accepted",
    in_progress: "In progress",
    blocked: "Blocked",
    completed: "Done",
    verified: "Verified",
    declined: "Declined",
    cancelled: "Cancelled",
};

/** Button text for moving a task to a status. */
export const STATUS_ACTIONS = {
    accepted: "Accept",
    in_progress: "Start",
    blocked: "Mark blocked",
    completed: "Mark done",
    verified: "Verify",
    declined: "Decline",
    cancelled: "Cancel task",
    pending: "Move to assigned",
};

export const CLOSED_STATUSES = ["completed", "verified", "declined", "cancelled"];
export const REASON_STATUSES = ["blocked", "declined"];

export const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

export const statusLabel = (task) => {
    if (!task) return "";
    if (task.statusLabel) return task.statusLabel;
    if (task.status === "completed") return task.requiresReview ? "Done – awaiting review" : "Done";
    return STATUS_LABELS[task.status] || task.status || "";
};

/** Moving a closed task back to work is a reopen and needs a reason. */
export const isReopen = (task, status) => CLOSED_STATUSES.includes(task?.status) && !CLOSED_STATUSES.includes(status);

export const needsReason = (task, status) => REASON_STATUSES.includes(status) || isReopen(task, status);

export const actionLabel = (task, status) =>
    isReopen(task, status) ? "Reopen" : STATUS_ACTIONS[status] || STATUS_LABELS[status] || status;

const dayKey = (d) => d.toISOString().slice(0, 10);

/** "Due Fri 4 Dec" / "Due today" / "Overdue · Mon 30 Nov", with a time when one is set. */
export const dueLabel = (task) => {
    if (!task?.dueDate && !task?.dueAt) return "";
    const raw = task.dueDate ? String(task.dueDate).slice(0, 10) : null;
    // dueDate is a calendar day stored at midnight UTC: read it as that day, not in local time.
    const day = raw ? new Date(`${raw}T12:00:00Z`) : new Date(task.dueAt);
    if (Number.isNaN(day.getTime())) return "";
    const key = raw || dayKey(day);
    const now = new Date();
    const todayKey = dayKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
    const tomorrow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    let text;
    if (key === todayKey) text = "today";
    else if (key === dayKey(tomorrow)) text = "tomorrow";
    else text = day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    if (task.dueTime) text += ` ${task.dueTime}`;
    return task.isOverdue ? `Overdue · ${text}` : `Due ${text}`;
};

export const dateTimeLabel = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const assigneeNames = (task) => {
    const list = task?.assignees?.length ? task.assignees : task?.assignedTo ? [task.assignedTo] : [];
    return list.map((a) => a?.employeeName || a?.name || "").filter(Boolean);
};

/** Short "Rahul, Priya +2". */
export const assigneeSummary = (task, max = 2) => {
    const names = assigneeNames(task);
    if (!names.length) return "";
    return names.length > max ? `${names.slice(0, max).join(", ")} +${names.length - max}` : names.join(", ");
};

/** Unique key per user action, so a retried request never creates a second task or comment. */
export const newIdempotencyKey = () => {
    try {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    } catch {
        // fall through
    }
    return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

/** Reads a File as base64 (without the data: prefix). */
export const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || "");
            resolve(result.slice(result.indexOf(",") + 1));
        };
        reader.onerror = () => reject(reader.error || new Error("Could not read the file"));
        reader.readAsDataURL(file);
    });

export const formatBytes = (n) => {
    const size = Number(n) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const MANAGER_ROLES = ["owner", "branch_head", "team_lead"];

/** Owner, branch head, team lead, or anyone the server lets assign to others. */
export const isManagerAccess = (access) => Boolean(access && (MANAGER_ROLES.includes(access.role) || access.canAssignOthers));

/** Today's date as YYYY-MM-DD in the device's time zone (for date inputs). */
export const todayInput = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
