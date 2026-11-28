import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A short confirmation line after a save ("Update sent"). Rendered in an aria-live region by the
 * caller, so screen readers announce it too. Errors stay until the next message.
 */
const useToast = (ms = 3500) => {
    const [toast, setToast] = useState(null);
    const timer = useRef(null);
    const show = useCallback(
        (text, tone = "success") => {
            window.clearTimeout(timer.current);
            setToast({ text, tone, at: Date.now() });
            if (tone !== "danger") timer.current = window.setTimeout(() => setToast(null), ms);
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
