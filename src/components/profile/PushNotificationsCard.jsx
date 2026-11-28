import { useEffect, useState } from "react";
import Icon from "../Icon";
import { getPushConfig } from "../../api/notifications.api";
import { currentSubscription, disablePush, enablePush, isPushSupported, pushPermission } from "../../pwa/push";
import { friendlyMessage } from "../../utils/errors";

/**
 * "Task notifications on this device": shown only when the server offers push and the browser
 * supports it. Turning it on asks for permission; turning it off removes this device.
 */
const PushNotificationsCard = () => {
    const [config, setConfig] = useState(null);
    const [on, setOn] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isPushSupported()) return undefined;
        let alive = true;
        getPushConfig()
            .then(async (cfg) => {
                if (!alive) return;
                setConfig(cfg || null);
                if (cfg?.enabled) {
                    const sub = await currentSubscription().catch(() => null);
                    if (alive) setOn(Boolean(sub) && pushPermission() === "granted");
                }
            })
            .catch(() => alive && setConfig(null));
        return () => {
            alive = false;
        };
    }, []);

    if (!config?.enabled || !config.publicKey) return null;
    const blocked = pushPermission() === "denied";

    const toggle = async () => {
        setBusy(true);
        setError("");
        setMessage("");
        try {
            if (on) {
                await disablePush();
                setOn(false);
                setMessage("This device won't get task notifications any more.");
            } else {
                const result = await enablePush(config.publicKey);
                if (result === "enabled") {
                    setOn(true);
                    setMessage("You'll be notified on this device.");
                } else if (result === "denied") {
                    setError("Notifications are blocked for this site. Allow them in your browser settings, then try again.");
                } else {
                    setError("This device can't receive notifications right now. Install or reopen the app and try again.");
                }
            }
        } catch (err) {
            setError(friendlyMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="card">
            <h3 className="card__title">Task notifications</h3>
            <div className="switch-row">
                <span id="push-label">
                    Get notified on this device
                    <span className="muted small"> — new assignments, update requests and comments.</span>
                </span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-labelledby="push-label"
                    className={`switch ${on ? "is-on" : ""}`}
                    onClick={toggle}
                    disabled={busy || (blocked && !on)}
                >
                    <span className="switch__knob" />
                </button>
            </div>
            {blocked && !on ? <p className="muted small">Notifications are blocked for this site in your browser settings.</p> : null}
            <div aria-live="polite">
                {message ? (
                    <p className="small text-success">
                        <Icon name="check" size={14} className="inline-icon" /> {message}
                    </p>
                ) : null}
                {error ? (
                    <p className="small text-danger" role="alert">
                        {error}
                    </p>
                ) : null}
            </div>
            <p className="muted small">Your task inbox in Wizz always works, with or without this.</p>
        </section>
    );
};

export default PushNotificationsCard;
