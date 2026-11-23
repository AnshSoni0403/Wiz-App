import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../Icon";
import { deleteConversation, listConversations } from "../../api/wizz.api";
import { friendlyMessage, toApiError } from "../../utils/errors";
import { relativeTime } from "../../utils/format";

/**
 * Conversation history (GET /wizz/conversations?channel=pwa): open, delete, new chat.
 */
const HistoryDrawer = ({ open, onClose, activeId, onOpenConversation, onNewChat, onDeleted, refreshKey }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const panelRef = useRef(null);

    const load = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            const list = await listConversations({ signal });
            setItems(Array.isArray(list) ? list : []);
        } catch (err) {
            if (toApiError(err).kind !== "cancelled") setError(err);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [open, load, refreshKey]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        panelRef.current?.focus();
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const remove = async (item) => {
        if (!window.confirm(`Delete "${item.title || "this conversation"}"?`)) return;
        setDeletingId(item.id);
        try {
            await deleteConversation(item.id);
            setItems((list) => list.filter((x) => x.id !== item.id));
            onDeleted(item.id);
        } catch (err) {
            window.alert(friendlyMessage(err));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className={`drawer ${open ? "is-open" : ""}`} aria-hidden={!open}>
            <div className="drawer__backdrop" onClick={onClose} />
            <aside
                className="drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-label="Conversation history"
                tabIndex={-1}
                ref={panelRef}
            >
                <div className="drawer__header">
                    <h2>History</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Close history">
                        <Icon name="close" size={20} />
                    </button>
                </div>
                <button type="button" className="btn btn--primary btn--block drawer__new" onClick={onNewChat}>
                    <Icon name="plus" size={18} /> New chat
                </button>

                <div className="drawer__list">
                    {loading && !items.length ? <div className="spinner spinner--center" aria-label="Loading" /> : null}
                    {error ? (
                        <div className="alert alert--danger small">
                            {friendlyMessage(error)}{" "}
                            <button type="button" className="link-btn" onClick={() => load()}>
                                Retry
                            </button>
                        </div>
                    ) : null}
                    {!loading && !error && !items.length ? (
                        <p className="muted small center">No conversations yet.</p>
                    ) : null}
                    <ul>
                        {items.map((item) => (
                            <li key={item.id} className={`history-item ${item.id === activeId ? "is-active" : ""}`}>
                                <button
                                    type="button"
                                    className="history-item__open"
                                    onClick={() => onOpenConversation(item.id)}
                                >
                                    <span className="history-item__title">{item.title || "Untitled chat"}</span>
                                    <span className="history-item__time">{relativeTime(item.updatedAt)}</span>
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn history-item__delete"
                                    onClick={() => remove(item)}
                                    disabled={deletingId === item.id}
                                    aria-label={`Delete ${item.title || "conversation"}`}
                                >
                                    <Icon name="trash" size={18} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>
        </div>
    );
};

export default HistoryDrawer;
