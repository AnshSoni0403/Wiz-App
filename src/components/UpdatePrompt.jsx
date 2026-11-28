import { ActionIcon, Button, Group, Paper, Text, ThemeIcon } from "@mantine/core";
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
        <Paper className="prompt-card" withBorder shadow="md" p="sm" radius="lg" role="status">
            <Group gap="sm" wrap="nowrap" align="center">
                <ThemeIcon size={36} radius="md" variant="light" color="gold">
                    <Icon name="refresh" size={18} />
                </ThemeIcon>
                <div className="prompt-card__text">
                    <Text size="sm" fw={600}>
                        Update available
                    </Text>
                    <Text size="xs" c="dimmed">
                        A new version of Wizz is ready.
                    </Text>
                </div>
                <Button size="xs" onClick={() => updateServiceWorker(true)}>
                    Reload
                </Button>
                <ActionIcon size="md" onClick={() => setNeedRefresh(false)} aria-label="Later">
                    <Icon name="close" size={16} />
                </ActionIcon>
            </Group>
        </Paper>
    );
};

export default UpdatePrompt;
