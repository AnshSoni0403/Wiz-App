import { Switch, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import Icon from "../Icon";
import SettingsRow from "./SettingsRow";
import { getPushConfig } from "../../api/notifications.api";
import { currentSubscription, disablePush, enablePush, isPushSupported, pushPermission } from "../../pwa/push";
import { friendlyMessage } from "../../utils/errors";

/**
 * "Notifications on this device" settings row: shown only when the server offers push and the browser
 * supports it. Turning it on asks for permission; turning it off removes this device.
 */
const PushNotificationsCard = () => {
    const [config, setConfig] = useState(null);
    const [on, setOn] = useState(false);
    const [busy, setBusy] = useState(false);
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
        try {
            if (on) {
                await disablePush();
                setOn(false);
                notifications.show({ message: "This device won't get task notifications any more.", color: "teal", icon: <Icon name="check" size={16} /> });
            } else {
                const result = await enablePush(config.publicKey);
                if (result === "enabled") {
                    setOn(true);
                    notifications.show({ message: "You'll be notified on this device.", color: "teal", icon: <Icon name="check" size={16} /> });
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
        <SettingsRow
            icon="bell"
            label="Notifications on this device"
            description={
                <>
                    {blocked && !on ? "Blocked in your browser settings." : "New assignments, update requests and comments."}
                    {error ? (
                        <Text size="xs" c="red.7" role="alert" mt={2}>
                            {error}
                        </Text>
                    ) : null}
                </>
            }
            right={
                <Switch
                    checked={on}
                    onChange={toggle}
                    disabled={busy || (blocked && !on)}
                    aria-label="Get task notifications on this device"
                    color="gold"
                />
            }
        />
    );
};

export default PushNotificationsCard;
