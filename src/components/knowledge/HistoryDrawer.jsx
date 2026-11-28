import { ActionIcon, Alert, Button, Drawer, Group, ScrollArea, Skeleton, Stack, Text, TextInput, ThemeIcon, UnstyledButton } from "@mantine/core";
import { IconMessageCircle, IconMessagePlus, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteConversation, listConversations } from "../../api/wizz.api";
import { friendlyMessage, toApiError } from "../../utils/errors";
import { relativeTime } from "../../utils/format";

const DAY = 24 * 3600 * 1000;
const groupOf = (value) => {
    const t = new Date(value).getTime();
    if (!Number.isFinite(t)) return "Older";
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    if (t >= startOfToday) return "Today";
    if (t >= startOfToday - 6 * DAY) return "Previous 7 days";
    return "Older";
};

/**
 * Conversation history (GET /wizz/conversations?channel=pwa): search, open, delete (two-step), new chat.
 */
const HistoryDrawer = ({ open, onClose, activeId, onOpenConversation, onNewChat, onDeleted, refreshKey }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [query, setQuery] = useState("");

    const load = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            const list = await listConversations({ signal });
            setItems(Array.isArray(list) ? list : []);
        } catch (err) {
            if (toApiError(err).kind !== "cancelled") setError(err);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        setConfirmId(null);
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [open, load, refreshKey]);

    const remove = async (item) => {
        setDeletingId(item.id);
        setError(null);
        try {
            await deleteConversation(item.id);
            setItems((list) => list.filter((x) => x.id !== item.id));
            onDeleted(item.id);
        } catch (err) {
            setError(err);
        } finally {
            setDeletingId(null);
            setConfirmId(null);
        }
    };

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q ? items.filter((i) => (i.title || "").toLowerCase().includes(q)) : items;
        const out = new Map();
        for (const item of filtered) {
            const g = groupOf(item.updatedAt);
            if (!out.has(g)) out.set(g, []);
            out.get(g).push(item);
        }
        return [...out.entries()];
    }, [items, query]);

    return (
        <Drawer
            opened={open}
            onClose={onClose}
            position="left"
            size={320}
            title={<Text fw={600}>Chats</Text>}
            padding="sm"
            scrollAreaComponent={ScrollArea.Autosize}
        >
            <Stack gap="xs">
                <Button leftSection={<IconMessagePlus size={17} />} fullWidth onClick={onNewChat}>
                    New chat
                </Button>
                <TextInput
                    placeholder="Search chats"
                    aria-label="Search chats"
                    leftSection={<IconSearch size={15} />}
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    rightSection={
                        query ? (
                            <ActionIcon size="sm" onClick={() => setQuery("")} aria-label="Clear search">
                                <IconX size={14} />
                            </ActionIcon>
                        ) : null
                    }
                />

                {error ? (
                    <Alert color="red" p="xs">
                        <Group justify="space-between" gap="xs">
                            <Text size="sm">{friendlyMessage(error)}</Text>
                            <Button size="compact-xs" variant="subtle" color="red" onClick={() => load()}>
                                Retry
                            </Button>
                        </Group>
                    </Alert>
                ) : null}

                {loading && !items.length
                    ? [1, 2, 3, 4].map((k) => <Skeleton key={k} height={44} />)
                    : null}

                {!loading && !error && !groups.length ? (
                    <Stack align="center" gap={6} py="lg">
                        <ThemeIcon variant="light" radius="xl" size={40}>
                            <IconMessageCircle size={20} />
                        </ThemeIcon>
                        <Text size="sm" c="dimmed">
                            {query ? "No chats match your search." : "No conversations yet."}
                        </Text>
                    </Stack>
                ) : null}

                {groups.map(([label, list]) => (
                    <div key={label}>
                        <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4} mt={4} className="history-group">
                            {label}
                        </Text>
                        <ul className="history-list">
                            {list.map((item) => (
                                <li key={item.id} className={`history-item${item.id === activeId ? " is-active" : ""}`}>
                                    <UnstyledButton className="history-item__open" onClick={() => onOpenConversation(item.id)} aria-current={item.id === activeId ? "page" : undefined}>
                                        <Text size="sm" fw={item.id === activeId ? 600 : 500} truncate>
                                            {item.title || "Untitled chat"}
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                            {relativeTime(item.updatedAt)}
                                        </Text>
                                    </UnstyledButton>
                                    {confirmId === item.id ? (
                                        <Group gap={4} wrap="nowrap">
                                            <Button size="compact-xs" color="red" loading={deletingId === item.id} onClick={() => remove(item)}>
                                                Delete
                                            </Button>
                                            <ActionIcon size="sm" onClick={() => setConfirmId(null)} aria-label="Keep conversation">
                                                <IconX size={14} />
                                            </ActionIcon>
                                        </Group>
                                    ) : (
                                        <ActionIcon
                                            size="md"
                                            className="history-item__delete"
                                            onClick={() => setConfirmId(item.id)}
                                            disabled={deletingId === item.id}
                                            aria-label={`Delete ${item.title || "conversation"}`}
                                        >
                                            <IconTrash size={16} stroke={1.75} />
                                        </ActionIcon>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </Stack>
        </Drawer>
    );
};

export default HistoryDrawer;
