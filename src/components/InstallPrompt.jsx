import { ActionIcon, Button, Group, Paper, Text, ThemeIcon } from "@mantine/core";
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
        <Paper className="prompt-card" withBorder shadow="md" p="sm" radius="lg" role="dialog" aria-label="Install Wizz">
            <Group gap="sm" wrap="nowrap" align="center">
                <ThemeIcon size={36} radius="md" variant="light" color="gold">
                    <Icon name={canInstall ? "download" : "share"} size={18} />
                </ThemeIcon>
                <div className="prompt-card__text">
                    <Text size="sm" fw={600}>
                        Install Wizz
                    </Text>
                    <Text size="xs" c="dimmed">
                        {canInstall ? (
                            "One-tap access from your home screen."
                        ) : (
                            <>
                                Tap <Icon name="share" size={12} className="inline-icon" /> Share, then <b>Add to Home Screen</b>.
                            </>
                        )}
                    </Text>
                </div>
                {canInstall ? (
                    <Button
                        size="xs"
                        onClick={async () => {
                            const outcome = await promptInstall();
                            if (outcome !== "accepted") dismiss();
                        }}
                    >
                        Install
                    </Button>
                ) : null}
                <ActionIcon size="md" onClick={dismiss} aria-label="Dismiss">
                    <Icon name="close" size={16} />
                </ActionIcon>
            </Group>
        </Paper>
    );
};

export default InstallPrompt;
