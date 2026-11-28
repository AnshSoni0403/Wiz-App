import { useEffect, useId, useRef } from "react";
import Icon from "./Icon";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal sheet: slides up from the bottom on phones, a centred dialog on wide screens.
 * Moves focus inside on open, keeps Tab inside, closes on Escape / backdrop, and returns focus
 * to whatever opened it.
 */
const Sheet = ({ open, title, onClose, children, footer = null, side = "bottom", busy = false }) => {
    const panelRef = useRef(null);
    const returnRef = useRef(null);
    const titleId = useId();
    // Latest callbacks without re-running the open/close effect on every render (which would move focus).
    const latest = useRef({ onClose, busy });
    latest.current = { onClose, busy };

    useEffect(() => {
        if (!open) return undefined;
        returnRef.current = document.activeElement;
        const panel = panelRef.current;
        const first = panel?.querySelector("[data-autofocus]") || panel?.querySelector(FOCUSABLE);
        (first || panel)?.focus();
        const onKey = (e) => {
            if (e.key === "Escape" && !latest.current.busy) {
                e.stopPropagation();
                latest.current.onClose();
                return;
            }
            if (e.key !== "Tab" || !panel) return;
            const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
            if (!items.length) return;
            const firstEl = items[0];
            const lastEl = items[items.length - 1];
            if (e.shiftKey && document.activeElement === firstEl) {
                e.preventDefault();
                lastEl.focus();
            } else if (!e.shiftKey && document.activeElement === lastEl) {
                e.preventDefault();
                firstEl.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            const back = returnRef.current;
            if (back && typeof back.focus === "function" && document.contains(back)) back.focus();
        };
    }, [open]);

    if (!open) return null;
    return (
        <div className={`sheet sheet--${side}`}>
            <div className="sheet__backdrop" onClick={busy ? undefined : onClose} aria-hidden="true" />
            <div className="sheet__panel" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
                <div className="sheet__header">
                    <h2 id={titleId} className="sheet__title">
                        {title}
                    </h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={busy}>
                        <Icon name="close" size={20} />
                    </button>
                </div>
                <div className="sheet__body">{children}</div>
                {footer ? <div className="sheet__footer">{footer}</div> : null}
            </div>
        </div>
    );
};

export default Sheet;
