import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";

/**
 * Save feedback ("Update sent"): a Mantine toast for sighted users plus the same text in an aria-live
 * region (LiveToast) so screen readers announce it. Errors stay until the next message.
 * Returns [toast, show(text, tone = "success" | "danger"), clear].
 */
const useToast = (ms = 3500) => {
    const [toast, setToast] = useState(null);
    const timer = useRef(null);
    const show = useCallback(
        (text, tone = "success") => {
            window.clearTimeout(timer.current);
            setToast({ text, tone, at: Date.now() });
            const danger = tone === "danger";
            notifications.show({
                message: text,
                color: danger ? "red" : "teal",
                icon: createElement(danger ? IconAlertTriangle : IconCheck, { size: 16 }),
                autoClose: danger ? 6000 : ms,
                withBorder: true,
            });
            if (!danger) timer.current = window.setTimeout(() => setToast(null), ms);
        },
        [ms]
    );
    const clear = useCallback(() => {
        window.clearTimeout(timer.current);
        setToast(null);
    }, []);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    return [toast, show, clear];
};

export default useToast;
