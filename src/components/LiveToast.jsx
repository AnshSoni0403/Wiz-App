import { ActionIcon } from "@mantine/core";
import Icon from "./Icon";

/** The visible + announced line for useToast(). Always mounted so the live region exists before text arrives. */
const LiveToast = ({ toast, onClose }) => (
    <div className="live-toast-region" aria-live="polite" role="status">
        {toast ? (
            <div className={`live-toast live-toast--${toast.tone}`}>
                <Icon name={toast.tone === "danger" ? "alert" : "check"} size={16} />
                <span>{toast.text}</span>
                {onClose ? (
                    <ActionIcon unstyled type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Dismiss">
                        <Icon name="close" size={14} />
                    </ActionIcon>
                ) : null}
            </div>
        ) : null}
    </div>
);

export default LiveToast;
