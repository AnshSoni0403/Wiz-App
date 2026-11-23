import { useState } from "react";
import Icon from "./Icon";
import { useInstallPrompt } from "../pwa/installPrompt";
import { readPref, writePref } from "../utils/storage";

const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

const isSnoozed = () => {
    const at = readPref("installDismissedAt", 0);
    return typeof at === "number" && Date.now() - at < SNOOZE_MS;
};

/** "Install app" card (Chrome/Edge/Android) or an "Add to Home Screen" hint on iOS. */
const InstallPrompt = () => {
    const { canInstall, promptInstall, standalone, ios } = useInstallPrompt();
    const [hidden, setHidden] = useState(isSnoozed);

    if (standalone || hidden || (!canInstall && !ios)) return null;

    const dismiss = () => {
        writePref("installDismissedAt", Date.now());
        setHidden(true);
    };

    return (
        <div className="toast" role="dialog" aria-label="Install Wizz">
            <div className="toast__icon">
                <Icon name={canInstall ? "download" : "share"} size={20} />
            </div>
            <div className="toast__body">
                <strong>Install Wizz</strong>
                {canInstall ? (
                    <span>Add Wizz to your home screen for one-tap access.</span>
                ) : (
                    <span>
                        Tap <Icon name="share" size={14} className="inline-icon" /> Share, then <b>Add to Home Screen</b>.
                    </span>
                )}
            </div>
            <div className="toast__actions">
                {canInstall ? (
                    <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={async () => {
                            const outcome = await promptInstall();
                            if (outcome !== "accepted") dismiss();
                        }}
                    >
                        Install
                    </button>
                ) : null}
                <button type="button" className="icon-btn" onClick={dismiss} aria-label="Dismiss">
                    <Icon name="close" size={18} />
                </button>
            </div>
        </div>
    );
};

export default InstallPrompt;
