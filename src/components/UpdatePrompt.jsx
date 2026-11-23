import { useRegisterSW } from "virtual:pwa-register/react";
import Icon from "./Icon";

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the service worker (app shell cache only) and offers a reload when a new
 * version has been deployed, instead of swapping code under the user mid-conversation.
 */
const UpdatePrompt = () => {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(_swUrl, registration) {
            if (registration) {
                setInterval(() => {
                    if (navigator.onLine) registration.update().catch(() => {});
                }, UPDATE_CHECK_MS);
            }
        },
    });

    if (!needRefresh) return null;

    return (
        <div className="toast" role="status">
            <div className="toast__icon">
                <Icon name="refresh" size={20} />
            </div>
            <div className="toast__body">
                <strong>Update available</strong>
                <span>A new version of Wizz is ready.</span>
            </div>
            <div className="toast__actions">
                <button type="button" className="btn btn--primary btn--sm" onClick={() => updateServiceWorker(true)}>
                    Reload
                </button>
                <button type="button" className="icon-btn" onClick={() => setNeedRefresh(false)} aria-label="Later">
                    <Icon name="close" size={18} />
                </button>
            </div>
        </div>
    );
};

export default UpdatePrompt;
