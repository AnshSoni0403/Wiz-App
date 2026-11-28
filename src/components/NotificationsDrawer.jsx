import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { useNotifications } from "../context/NotificationsContext";
import { listNotifications, markAllRead, markRead } from "../api/notifications.api";
import { friendlyMessage, isRetryable, toApiError } from "../utils/errors";
import { relativeTime } from "../utils/format";

const PER_PAGE = 20;

const KIND_ICONS = {
    assigned: "tasks",
    reassigned: "users",
    follow_up: "flag",
    comment: "message",
    due_changed: "clock",
    reminder: "clock",
    overdue: "alert",
    escalation: "alert",
    blocked: "alert",
    review_needed: "check",
    completed: "check",
    verified: "check",
    reopened: "refresh",
    digest: "list",
};

/**
 * Notification inbox (right-hand drawer): newest first, unread highlighted, "Mark all read", and
 * tapping an item marks it read and opens its task.
 */
const NotificationsDrawer = ({ tasksPath = "/tasks" }) => {
    const notifications = useNotifications();
    const navigate = useNavigate();
    const open = Boolean(notifications?.inboxOpen);
    const close = notifications?.closeInbox;
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [onlyUnread, setOnlyUnread] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const panelRef = useRef(null);
    const returnRef = useRef(null);
    const closeRef = useRef(close);
    closeRef.current = close;

    const load = useCallback(
        async (nextPage = 1, signal) => {
            setLoading(true);
            setError(null);
            try {
                const data = await listNotifications({ unread: onlyUnread, page: nextPage, perPage: PER_PAGE }, { signal });
                const list = Array.isArray(data?.items) ? data.items : [];
                setItems((prev) => (nextPage === 1 ? list : [...prev, ...list]));
                setTotal(Number(data?.total) || 0);
                setPage(nextPage);
                if (typeof data?.unread === "number") notifications?.setUnread(data.unread);
            } catch (err) {
                if (toApiError(err).kind !== "cancelled") setError(err);
            } finally {
                if (!signal?.aborted) setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [onlyUnread]
    );

    useEffect(() => {
        if (!open) return undefined;
        const controller = new AbortController();
        load(1, controller.signal);
        return () => controller.abort();
    }, [open, load]);

    useEffect(() => {
        if (!open) return undefined;
        returnRef.current = document.activeElement;
        panelRef.current?.focus();
        const onKey = (e) => {
            if (e.key === "Escape") closeRef.current?.();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            const back = returnRef.current;
            if (back && typeof back.focus === "function" && document.contains(back)) back.focus();
        };
    }, [open]);

    if (!notifications) return null;

    const openItem = async (item) => {
        if (!item.readAt) {
            setItems((list) => list.map((n) => (n._id === item._id ? { ...n, readAt: new Date().toISOString() } : n)));
            notifications.setUnread((n) => Math.max(0, n - 1));
            markRead(item._id).catch(() => notifications.refresh());
        }
        if (item.taskId) {
            close();
            navigate(`${tasksPath}/${encodeURIComponent(item.taskId)}`);
        }
    };

    const readAll = async () => {
        setBusy(true);
        try {
            await markAllRead();
            const now = new Date().toISOString();
            setItems((list) => (onlyUnread ? [] : list.map((n) => (n.readAt ? n : { ...n, readAt: now }))));
            notifications.setUnread(0);
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    };

    const unreadHere = items.some((n) => !n.readAt);

    return (
        <div className={`drawer drawer--right ${open ? "is-open" : ""}`} aria-hidden={!open}>
            <div className="drawer__backdrop" onClick={close} />
            <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="Notifications" tabIndex={-1} ref={panelRef}>
                <div className="drawer__header">
                    <h2>Notifications</h2>
                    <button type="button" className="icon-btn" onClick={close} aria-label="Close notifications">
                        <Icon name="close" size={20} />
                    </button>
                </div>
                <div className="inbox-tools">
                    <div className="segmented segmented--sm" role="group" aria-label="Show">
                        <button type="button" aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>
                            All
                        </button>
                        <button type="button" aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>
                            Unread{notifications.unread ? ` (${notifications.unread})` : ""}
                        </button>
                    </div>
                    <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={readAll}
                        disabled={busy || (!unreadHere && !notifications.unread)}
                    >
                        Mark all read
                    </button>
                </div>
                <div className="drawer__list">
                    {error ? (
                        <div className="notice notice--danger" role="alert">
                            <Icon name="alert" size={16} />
                            <div>
                                <p>{friendlyMessage(error)}</p>
                                {isRetryable(error) || toApiError(error).kind === "http" ? (
                                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => load(1)}>
                                        Retry
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                    {!loading && !error && !items.length ? (
                        <div className="empty-state">
                            <Icon name="bell" size={28} />
                            <p>{onlyUnread ? "You're all caught up." : "No notifications yet."}</p>
                            <p className="muted small">New assignments, update requests and comments on your tasks appear here.</p>
                        </div>
                    ) : null}
                    <ul className="inbox-list">
                        {items.map((n) => (
                            <li key={n._id}>
                                <button
                                    type="button"
                                    className={`inbox-item ${n.readAt ? "" : "is-unread"}`}
                                    onClick={() => openItem(n)}
                                >
                                    <span className={`inbox-item__icon inbox-item__icon--${n.kind}`}>
                                        <Icon name={KIND_ICONS[n.kind] || "bell"} size={18} />
                                    </span>
                                    <span className="inbox-item__text">
                                        <span className="inbox-item__title">
                                            {n.taskNumber ? <span className="task-num">#{n.taskNumber}</span> : null} {n.title}
                                        </span>
                                        {n.body ? <span className="inbox-item__body">{n.body}</span> : null}
                                        <span className="inbox-item__meta">
                                            {[n.actorName, relativeTime(n.createdAt)].filter(Boolean).join(" · ")}
                                        </span>
                                    </span>
                                    {!n.readAt ? <span className="unread-dot" aria-label="Unread" /> : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {loading ? <div className="spinner spinner--center" aria-label="Loading notifications" /> : null}
                    {!loading && items.length < total ? (
                        <button type="button" className="btn btn--ghost btn--block" onClick={() => load(page + 1)}>
                            Load more
                        </button>
                    ) : null}
                </div>
            </aside>
        </div>
    );
};

export default NotificationsDrawer;
