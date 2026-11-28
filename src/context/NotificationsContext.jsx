/* eslint-disable react-refresh/only-export-components */
/**
 * Unread task notifications for the signed-in member: polled every 45 s, on window focus and when
 * the app becomes visible again, and refreshed by screens after they change something.
 * The inbox drawer is opened from the bell in the top bar.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getUnreadCount } from "../api/notifications.api";
import { toApiError } from "../utils/errors";

const POLL_MS = 45000;

const NotificationsContext = createContext(null);

export const NotificationsProvider = ({ enabled = true, children }) => {
    const [unread, setUnread] = useState(0);
    const [available, setAvailable] = useState(enabled);
    const [inboxOpen, setInboxOpen] = useState(false);
    const inFlight = useRef(null);

    const refresh = useCallback(async () => {
        if (!enabled || inFlight.current) return;
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;
        const controller = new AbortController();
        inFlight.current = controller;
        try {
            const data = await getUnreadCount({ signal: controller.signal });
            setUnread(Math.max(0, Number(data?.unread) || 0));
            setAvailable(true);
        } catch (err) {
            const e = toApiError(err);
            // An older server without the inbox (404) or no access (403): hide the bell quietly.
            if (e.kind === "http" && (e.status === 404 || e.status === 403)) setAvailable(false);
        } finally {
            inFlight.current = null;
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return undefined;
        refresh();
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") refresh();
        }, POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === "visible") refresh();
        };
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", onVisible);
            inFlight.current?.abort();
        };
    }, [enabled, refresh]);

    const value = useMemo(
        () => ({
            unread,
            setUnread,
            available: enabled && available,
            refresh,
            inboxOpen,
            openInbox: () => setInboxOpen(true),
            closeInbox: () => setInboxOpen(false),
        }),
        [unread, enabled, available, refresh, inboxOpen]
    );

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

/** null outside the signed-in shell (e.g. on the login screen). */
export const useNotifications = () => useContext(NotificationsContext);

export default NotificationsContext;
