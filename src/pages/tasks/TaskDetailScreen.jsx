import { ActionIcon, Button, Paper } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import Icon from "../../components/Icon";
import Sheet from "../../components/Sheet";
import LiveToast from "../../components/LiveToast";
import TextSheet from "./TextSheet";
import { PriorityTag, StatusChip } from "./TaskCard";
import {
    addAttachment,
    addChecklistItem,
    addComment,
    deleteAttachment,
    deleteChecklistItem,
    getTask,
    reviewTask,
    setFollowUp,
    setTaskStatus,
    setWatching,
    updateChecklistItem,
    updateTask,
} from "../../api/tasks.api";
import { useNotifications } from "../../context/NotificationsContext";
import useToast from "../../hooks/useToast";
import { friendlyMessage, isRetryable, toApiError } from "../../utils/errors";
import { relativeTime } from "../../utils/format";
import {
    MAX_ATTACHMENT_BYTES,
    PRIORITY_LABELS,
    actionLabel,
    assigneeNames,
    dateTimeLabel,
    dueLabel,
    fileToBase64,
    formatBytes,
    isReopen,
    needsReason,
    newIdempotencyKey,
    todayInput,
} from "../../utils/tasks";

const ACCEPT = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";
const ACTIVITY_ICONS = {
    created: "plus",
    assigned: "users",
    comment: "message",
    status: "refresh",
    edit: "document",
    follow_up: "flag",
    review: "check",
    checklist: "check",
    attachment: "paperclip",
    reminder: "clock",
    escalation: "alert",
};

const isTask = (data) => Boolean(data && typeof data === "object" && data._id);

/**
 * One task: details, status actions from the server's permissions, review, follow-ups,
 * checklist, evidence and the full history with a reply box.
 */
const TaskDetailScreen = ({ basePath }) => {
    const { taskId } = useParams();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState("");
    const [sheet, setSheet] = useState(null); // { kind, status? }
    const [comment, setComment] = useState("");
    const [commentKey, setCommentKey] = useState(newIdempotencyKey);
    const [newItem, setNewItem] = useState("");
    const [toast, showToast, clearToast] = useToast();
    const notifications = useNotifications();
    const fileRef = useRef(null);
    const cameraRef = useRef(null);
    const commentRef = useRef(null);

    const load = useCallback(
        async (signal) => {
            setError(null);
            try {
                const data = await getTask(taskId, { signal });
                setTask(data);
            } catch (err) {
                if (toApiError(err).kind !== "cancelled") setError(err);
            } finally {
                if (!signal?.aborted) setLoading(false);
            }
        },
        [taskId]
    );

    useEffect(() => {
        setLoading(true);
        setTask(null);
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load]);

    /** Runs one change, applies the returned task (or reloads), announces the result. */
    const run = async (label, work, success) => {
        setBusy(label);
        clearToast();
        try {
            const data = await work();
            if (isTask(data)) setTask(data);
            else await load();
            if (success) showToast(success);
            notifications?.refresh();
            return data;
        } catch (err) {
            showToast(friendlyMessage(err), "danger");
            throw err;
        } finally {
            setBusy("");
        }
    };

    const quiet = (promise) => promise.catch(() => {});

    if (loading) {
        return (
            <div className="page">
                <TopBar title="Task" leading={<BackLink basePath={basePath} />} />
                <div className="page__body">
                    <div className="spinner spinner--center" role="status" aria-label="Loading task" />
                </div>
            </div>
        );
    }

    if (error || !task) {
        const e = toApiError(error);
        return (
            <div className="page">
                <TopBar title="Task" leading={<BackLink basePath={basePath} />} />
                <div className="page__body">
                    <div className="notice notice--danger" role="alert">
                        <Icon name="alert" size={18} />
                        <div>
                            <p>{e.status === 404 ? "This task doesn't exist or you no longer have access to it." : friendlyMessage(error)}</p>
                            <div className="row">
                                {isRetryable(error) || e.kind !== "http" ? (
                                    <Button unstyled type="button" className="btn btn--secondary btn--sm" onClick={() => load()}>
                                        Retry
                                    </Button>
                                ) : null}
                                <Link className="btn btn--ghost btn--sm" to={basePath}>
                                    Back to tasks
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const p = task.permissions || { canManage: task.canManage, isAssignee: task.isAssignee, allowedStatuses: [] };
    const canWork = Boolean(p.canWork || p.isAssignee || p.canManage);
    const reviewing = Boolean(p.canReview && task.status === "completed");
    const statusButtons = (p.allowedStatuses || []).filter(
        (s) => s !== task.status && !(reviewing && (s === "verified" || s === "in_progress"))
    );
    const names = assigneeNames(task);
    const activity = [...(task.activity || [])].sort((a, b) => new Date(a.at) - new Date(b.at));
    const checklist = task.checklist || [];
    const done = checklist.filter((c) => c.done).length;

    const changeStatus = (status) => {
        if (status === "verified" && task.status === "completed") {
            quiet(run("status", () => reviewTask(task._id, "approve"), "Task verified"));
            return;
        }
        if (needsReason(task, status)) {
            setSheet({ kind: "reason", status });
            return;
        }
        quiet(run("status", () => setTaskStatus(task._id, status), `Marked ${actionLabel(task, status).toLowerCase().replace(/^mark /, "")}`));
    };

    const reasonCopy = (status) => {
        if (isReopen(task, status)) return { title: "Reopen task", label: "Why is it being reopened?", submit: "Reopen" };
        if (status === "blocked") return { title: "What's blocking it?", label: "Reason", submit: "Mark blocked" };
        return { title: "Decline task", label: "Why are you declining it?", submit: "Decline" };
    };

    const sendComment = async (e) => {
        e.preventDefault();
        const message = comment.trim();
        if (!message || busy) return;
        try {
            await run("comment", () => addComment(task._id, message, commentKey), task.needsFollowUp && p.isAssignee ? "Update sent" : "Comment added");
            setComment("");
            setCommentKey(newIdempotencyKey());
        } catch {
            // the toast shows the error; the text and key stay for a retry
        }
    };

    const onFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (file.size > MAX_ATTACHMENT_BYTES) {
            showToast(`That file is ${formatBytes(file.size)}. Files can be up to 3 MB.`, "danger");
            return;
        }
        try {
            const dataBase64 = await fileToBase64(file);
            await run(
                "attach",
                () => addAttachment(task._id, { name: file.name || "photo.jpg", mimeType: file.type || "application/octet-stream", dataBase64 }),
                "Evidence attached"
            );
        } catch {
            // shown
        }
    };

    const toggleItem = (item) =>
        quiet(run(`item-${item._id}`, () => updateChecklistItem(task._id, item._id, { done: !item.done }), item.done ? "Item reopened" : "Item done"));

    const addItem = async (e) => {
        e.preventDefault();
        const text = newItem.trim();
        if (!text) return;
        try {
            await run("item-add", () => addChecklistItem(task._id, text), "Checklist item added");
            setNewItem("");
        } catch {
            // shown
        }
    };

    return (
        <div className="page">
            <TopBar title={task.number ? `Task #${task.number}` : "Task"} leading={<BackLink basePath={basePath} />}>
                <ActionIcon unstyled
                    type="button"
                    className="icon-btn"
                    onClick={() => quiet(run("watch", () => setWatching(task._id, !p.isWatcher), p.isWatcher ? "Stopped watching" : "Watching this task"))}
                    aria-pressed={Boolean(p.isWatcher)}
                    aria-label={p.isWatcher ? "Stop watching this task" : "Watch this task"}
                    disabled={Boolean(busy) || p.isAssignee}
                    title={p.isWatcher ? "Watching" : "Watch"}
                >
                    <Icon name="eye" size={20} className={p.isWatcher ? "is-on" : ""} />
                </ActionIcon>
            </TopBar>

            <div className="page__body task-detail">
                <LiveToast toast={toast} onClose={clearToast} />

                <Paper component="section" className="card task-head">
                    <div className="task-card__top">
                        <StatusChip task={task} />
                        <PriorityTag priority={task.priority} />
                        {task.team?.name ? (
                            <span className="team-badge">
                                <Icon name="users" size={12} /> {task.team.name}
                                {task.assignmentMode === "shared" ? " · shared" : ""}
                            </span>
                        ) : null}
                        {task.branch ? <span className="chip chip--xs">{task.branch}</span> : null}
                    </div>
                    <h1 className="task-head__title">{task.title}</h1>
                    {task.description ? <p className="task-head__desc">{task.description}</p> : null}
                    <dl className="task-facts">
                        <div>
                            <dt>Due</dt>
                            <dd className={task.isOverdue ? "text-danger" : ""}>
                                {dueLabel(task) || "No due date"}
                                {task.timezone && task.dueTime ? <span className="muted small"> ({task.timezone})</span> : null}
                            </dd>
                        </div>
                        <div>
                            <dt>{names.length > 1 ? "Assignees" : "Assignee"}</dt>
                            <dd>{names.join(", ") || "—"}</dd>
                        </div>
                        <div>
                            <dt>Assigned by</dt>
                            <dd>{task.createdByName || "—"}</dd>
                        </div>
                        {task.watchers?.length ? (
                            <div>
                                <dt>Watching</dt>
                                <dd>{task.watchers.map((w) => w.employeeName || w.name).join(", ")}</dd>
                            </div>
                        ) : null}
                        {task.requiresReview ? (
                            <div>
                                <dt>Review</dt>
                                <dd>{task.verifiedAt ? `Verified${task.reviewedByName ? ` by ${task.reviewedByName}` : ""}` : "Needs manager review when done"}</dd>
                            </div>
                        ) : null}
                    </dl>
                </Paper>

                {task.needsFollowUp ? (
                    <div className="notice notice--warning" role="note">
                        <Icon name="flag" size={18} />
                        <div>
                            <p>
                                <strong>{task.followUp?.requestedByName || "Your manager"} asked for an update</strong>
                                {task.followUp?.requestedAt ? <span className="muted small"> · {relativeTime(task.followUp.requestedAt)}</span> : null}
                            </p>
                            {task.followUp?.note ? <p>“{task.followUp.note}”</p> : null}
                            <div className="row">
                                {p.isAssignee ? (
                                    <Button unstyled type="button" className="btn btn--secondary btn--sm" onClick={() => commentRef.current?.focus()}>
                                        Reply with an update
                                    </Button>
                                ) : null}
                                {p.canManage ? (
                                    <Button unstyled
                                        type="button"
                                        className="btn btn--ghost btn--sm"
                                        disabled={Boolean(busy)}
                                        onClick={() => quiet(run("followup", () => setFollowUp(task._id, false), "Request withdrawn"))}
                                    >
                                        Withdraw request
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}

                {task.status === "blocked" && task.blockedReason ? (
                    <div className="notice notice--danger" role="note">
                        <Icon name="alert" size={18} />
                        <p>
                            <strong>Blocked:</strong> {task.blockedReason}
                        </p>
                    </div>
                ) : null}
                {task.status === "declined" && task.declinedReason ? (
                    <div className="notice notice--danger" role="note">
                        <Icon name="alert" size={18} />
                        <p>
                            <strong>Declined:</strong> {task.declinedReason}
                        </p>
                    </div>
                ) : null}

                {reviewing ? (
                    <Paper component="section" className="card card--accent" aria-label="Review">
                        <h2 className="card__title">Ready for your review</h2>
                        <p className="muted small">
                            {names.join(", ") || "The assignee"} marked this done{task.completedAt ? ` ${relativeTime(task.completedAt)}` : ""}. Check the
                            updates and evidence below.
                        </p>
                        <div className="row">
                            <Button unstyled
                                type="button"
                                className="btn btn--primary"
                                disabled={Boolean(busy)}
                                onClick={() => quiet(run("review", () => reviewTask(task._id, "approve"), "Task verified"))}
                            >
                                <Icon name="check" size={18} /> Verify
                            </Button>
                            <Button unstyled type="button" className="btn btn--ghost" disabled={Boolean(busy)} onClick={() => setSheet({ kind: "reviewReopen" })}>
                                Reopen
                            </Button>
                        </div>
                    </Paper>
                ) : null}

                {statusButtons.length || p.canManage ? (
                    <section className="task-actions" aria-label="Actions">
                        {statusButtons.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={`btn ${s === "completed" ? "btn--primary" : s === "cancelled" || s === "declined" ? "btn--danger-outline" : "btn--secondary"}`}
                                disabled={Boolean(busy)}
                                onClick={() => changeStatus(s)}
                            >
                                {actionLabel(task, s)}
                            </button>
                        ))}
                        {p.canManage && !["completed", "verified", "cancelled", "declined"].includes(task.status) && !task.needsFollowUp ? (
                            <Button unstyled type="button" className="btn btn--ghost" disabled={Boolean(busy)} onClick={() => setSheet({ kind: "followup" })}>
                                <Icon name="flag" size={16} /> Request update
                            </Button>
                        ) : null}
                        {p.canManage ? (
                            <Button unstyled type="button" className="btn btn--ghost" disabled={Boolean(busy)} onClick={() => setSheet({ kind: "edit" })}>
                                Edit
                            </Button>
                        ) : null}
                    </section>
                ) : null}

                <Paper component="section" className="card" aria-labelledby="checklist-title">
                    <h2 className="card__title" id="checklist-title">
                        Checklist {checklist.length ? <span className="muted small">{done}/{checklist.length}</span> : null}
                    </h2>
                    {checklist.length ? (
                        <ul className="checklist">
                            {checklist.map((item) => (
                                <li key={item._id} className={item.done ? "is-done" : ""}>
                                    <label>
                                        <input type="checkbox" checked={Boolean(item.done)} disabled={!canWork || Boolean(busy)} onChange={() => toggleItem(item)} />
                                        <span>
                                            {item.text}
                                            {item.done && item.doneByName ? <span className="muted small"> · {item.doneByName}</span> : null}
                                        </span>
                                    </label>
                                    {p.canManage ? (
                                        <ActionIcon unstyled
                                            type="button"
                                            className="icon-btn icon-btn--sm"
                                            aria-label={`Remove “${item.text}”`}
                                            disabled={Boolean(busy)}
                                            onClick={() => quiet(run(`item-del-${item._id}`, () => deleteChecklistItem(task._id, item._id), "Item removed"))}
                                        >
                                            <Icon name="trash" size={14} />
                                        </ActionIcon>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="muted small">No checklist items.</p>
                    )}
                    {canWork ? (
                        <form className="inline-form" onSubmit={addItem}>
                            <label className="sr-only" htmlFor="new-check-item">
                                New checklist item
                            </label>
                            <input
                                id="new-check-item"
                                className="input"
                                maxLength={300}
                                value={newItem}
                                placeholder="Add an item"
                                onChange={(e) => setNewItem(e.target.value)}
                            />
                            <Button unstyled type="submit" className="btn btn--secondary" disabled={!newItem.trim() || Boolean(busy)}>
                                Add
                            </Button>
                        </form>
                    ) : null}
                </Paper>

                <Paper component="section" className="card" aria-labelledby="evidence-title">
                    <h2 className="card__title" id="evidence-title">
                        Evidence & files
                    </h2>
                    {task.attachments?.length ? (
                        <ul className="attachments">
                            {task.attachments.map((a) => {
                                const isImage = a.kind !== "link" && String(a.mimeType || "").startsWith("image/");
                                return (
                                    <li key={a._id} className="attachment">
                                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="attachment__open">
                                            {isImage ? (
                                                <img src={a.url} alt={a.name || "Attached photo"} className="attachment__thumb" loading="lazy" />
                                            ) : (
                                                <span className="attachment__icon">
                                                    <Icon name={a.kind === "link" ? "link" : "document"} size={20} />
                                                </span>
                                            )}
                                            <span className="attachment__text">
                                                <span className="attachment__name">{a.name || a.url}</span>
                                                <span className="muted small">
                                                    {[a.kind === "link" ? "Link" : formatBytes(a.size), a.uploadedByName, relativeTime(a.at)].filter(Boolean).join(" · ")}
                                                </span>
                                            </span>
                                        </a>
                                        {(a.canDelete ?? p.canManage) ? (
                                            <ActionIcon unstyled
                                                type="button"
                                                className="icon-btn icon-btn--sm"
                                                aria-label={`Remove ${a.name || "attachment"}`}
                                                disabled={Boolean(busy)}
                                                onClick={() => {
                                                    if (window.confirm(`Remove ${a.name || "this attachment"}?`)) {
                                                        quiet(run(`att-${a._id}`, () => deleteAttachment(task._id, a._id), "Attachment removed"));
                                                    }
                                                }}
                                            >
                                                <Icon name="trash" size={14} />
                                            </ActionIcon>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="muted small">No files yet. Add a photo, document or link as proof of progress.</p>
                    )}
                    {canWork ? (
                        <div className="row">
                            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
                            <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={onFile} />
                            <Button unstyled type="button" className="btn btn--secondary btn--sm" disabled={Boolean(busy)} onClick={() => cameraRef.current?.click()}>
                                <Icon name="camera" size={16} /> Photo
                            </Button>
                            <Button unstyled type="button" className="btn btn--secondary btn--sm" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
                                <Icon name="paperclip" size={16} /> File
                            </Button>
                            <Button unstyled type="button" className="btn btn--ghost btn--sm" disabled={Boolean(busy)} onClick={() => setSheet({ kind: "link" })}>
                                <Icon name="link" size={16} /> Link
                            </Button>
                            {busy === "attach" ? <span className="muted small" role="status">Uploading…</span> : null}
                        </div>
                    ) : null}
                </Paper>

                <Paper component="section" className="card" aria-labelledby="activity-title">
                    <h2 className="card__title" id="activity-title">
                        Updates & history
                    </h2>
                    {activity.length ? (
                        <ol className="timeline">
                            {activity.map((entry, i) => (
                                <li key={entry._id || i} className={`timeline__item timeline__item--${entry.type}`}>
                                    <span className="timeline__icon" aria-hidden="true">
                                        <Icon name={ACTIVITY_ICONS[entry.type] || "info"} size={14} />
                                    </span>
                                    <div className="timeline__body">
                                        <div className="timeline__meta">
                                            <strong>{entry.byName || (entry.byType === "SYSTEM" ? "Wizz" : "Someone")}</strong>
                                            <time dateTime={entry.at} title={dateTimeLabel(entry.at)}>
                                                {relativeTime(entry.at)}
                                            </time>
                                        </div>
                                        <p className={entry.type === "comment" ? "timeline__comment" : "timeline__note"}>{entry.message}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="muted small">No updates yet.</p>
                    )}
                </Paper>

                {p.canComment !== false ? (
                    <form className="task-composer" onSubmit={sendComment}>
                        <label htmlFor="task-comment" className="sr-only">
                            {task.needsFollowUp && p.isAssignee ? "Your update" : "Add a comment"}
                        </label>
                        <textarea
                            id="task-comment"
                            ref={commentRef}
                            className="input"
                            rows={2}
                            maxLength={2000}
                            value={comment}
                            disabled={busy === "comment"}
                            placeholder={task.needsFollowUp && p.isAssignee ? "Write your update…" : "Add a comment or follow-up…"}
                            onChange={(e) => setComment(e.target.value)}
                        />
                        <Button unstyled type="submit" className="btn btn--primary" disabled={!comment.trim() || Boolean(busy)} aria-label="Send">
                            <Icon name="send" size={18} />
                            <span className="hide-narrow">{busy === "comment" ? "Sending…" : "Send"}</span>
                        </Button>
                    </form>
                ) : null}
            </div>

            {sheet?.kind === "reason" ? (
                <TextSheet
                    open
                    title={reasonCopy(sheet.status).title}
                    label={reasonCopy(sheet.status).label}
                    submitLabel={reasonCopy(sheet.status).submit}
                    onClose={() => setSheet(null)}
                    onSubmit={async (reason) => {
                        await run("status", () => setTaskStatus(task._id, sheet.status, reason), isReopen(task, sheet.status) ? "Task reopened" : "Status updated");
                        setSheet(null);
                    }}
                />
            ) : null}
            {sheet?.kind === "reviewReopen" ? (
                <TextSheet
                    open
                    title="Reopen for more work"
                    label="What still needs doing?"
                    submitLabel="Reopen"
                    onClose={() => setSheet(null)}
                    onSubmit={async (note) => {
                        await run("review", () => reviewTask(task._id, "reopen", note), "Task reopened");
                        setSheet(null);
                    }}
                />
            ) : null}
            {sheet?.kind === "followup" ? (
                <TextSheet
                    open
                    title="Request an update"
                    label="Message (optional)"
                    hint={`${names.join(", ") || "The assignee"} will be notified.`}
                    required={false}
                    submitLabel="Send request"
                    onClose={() => setSheet(null)}
                    onSubmit={async (note) => {
                        await run("followup", () => setFollowUp(task._id, true, note), "Update requested");
                        setSheet(null);
                    }}
                />
            ) : null}
            {sheet?.kind === "link" ? (
                <TextSheet
                    open
                    title="Add a link"
                    label="Link (https://…)"
                    multiline={false}
                    type="url"
                    maxLength={2000}
                    submitLabel="Add link"
                    onClose={() => setSheet(null)}
                    onSubmit={async (url) => {
                        await run("attach", () => addAttachment(task._id, { url }), "Link added");
                        setSheet(null);
                    }}
                />
            ) : null}
            <EditSheet
                open={sheet?.kind === "edit"}
                task={task}
                onClose={() => setSheet(null)}
                onSave={async (body) => {
                    await run("edit", () => updateTask(task._id, body), "Task updated");
                    setSheet(null);
                }}
            />
        </div>
    );
};

const BackLink = ({ basePath }) => (
    <Link to={basePath} className="icon-btn" aria-label="Back to tasks">
        <Icon name="chevronLeft" size={22} />
    </Link>
);

/** Managers: due date, time and priority (reassigning is done in chat or Admin). */
const EditSheet = ({ open, task, onClose, onSave }) => {
    const [due, setDue] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [priority, setPriority] = useState("medium");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return;
        setDue(task?.dueDate ? String(task.dueDate).slice(0, 10) : "");
        setDueTime(task?.dueTime || "");
        setPriority(task?.priority || "medium");
        setNote("");
        setError(null);
    }, [open, task]);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const body = { priority };
        const oldDue = task?.dueDate ? String(task.dueDate).slice(0, 10) : "";
        if (due !== oldDue || (dueTime || "") !== (task?.dueTime || "")) {
            body.due = due || null;
            body.dueTime = due && dueTime ? dueTime : null;
        }
        if (note.trim()) body.note = note.trim();
        try {
            await onSave(body);
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet
            open={open}
            title="Edit task"
            onClose={onClose}
            busy={busy}
            footer={
                <div className="row row--end">
                    <Button unstyled type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button unstyled type="submit" form="edit-task-form" className="btn btn--primary" disabled={busy}>
                        {busy ? "Saving…" : "Save"}
                    </Button>
                </div>
            }
        >
            <form id="edit-task-form" className="form" onSubmit={submit}>
                {error ? (
                    <div className="notice notice--danger" role="alert">
                        <Icon name="alert" size={16} />
                        <p>{friendlyMessage(error)}</p>
                    </div>
                ) : null}
                <div className="field-row">
                    <label className="field">
                        <span className="field__label">Due date</span>
                        <input type="date" className="input" data-autofocus min={todayInput()} value={due} onChange={(e) => setDue(e.target.value)} />
                    </label>
                    <label className="field">
                        <span className="field__label">Time</span>
                        <input type="time" className="input" value={dueTime} disabled={!due} onChange={(e) => setDueTime(e.target.value)} />
                    </label>
                </div>
                <label className="field">
                    <span className="field__label">Priority</span>
                    <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="field">
                    <span className="field__label">Note to the assignee (optional)</span>
                    <textarea className="input" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <p className="muted small">The assignee is notified when the due date changes.</p>
            </form>
        </Sheet>
    );
};

export default TaskDetailScreen;
