import { ActionIcon, Alert, Badge, Button, Drawer, Group, ScrollArea, SegmentedControl, Skeleton, Stack, Text, ThemeIcon, Tooltip, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconChecks } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { useNotifications } from "../context/NotificationsContext";
import { listNotifications, markAllRead, markRead } from "../api/notifications.api";
import { friendlyMessage, isRetryable, toApiError } from "../utils/errors";
import { relativeTime } from "../utils/format";

const PER_PAGE = 20;

// Icon and soft colour per notification kind.
const KINDS = {
    assigned: ["tasks", "gold"],
    reassigned: ["users", "blue"],
    follow_up: ["flag", "orange"],
    comment: ["message", "blue"],
    due_changed: ["due", "gold"],
    reminder: ["clock", "gold"],
    overdue: ["alert", "red"],
    escalation: ["alert", "red"],
    blocked: ["blocked", "red"],
    review_needed: ["done", "teal"],
    completed: ["done", "teal"],
    verified: ["done", "green"],
    reopened: ["refresh", "orange"],
    cancelled: ["close", "gray"],
    status: ["progress", "gray"],
    digest: ["list", "gray"],
};

const RowSkeleton = () => (
    <Group gap="sm" wrap="nowrap" p="sm">
        <Skeleton circle height={36} />
        <Stack gap={6} style={{ flex: 1 }}>
            <Skeleton height={10} width="80%" />
            <Skeleton height={8} width="55%" />
        </Stack>
    </Group>
);

/**
 * Notification inbox: right-hand drawer (full screen on phones), newest first, unread highlighted,
 * All / Unread, "Mark all read", and tapping an item marks it read and opens its task.
 */
const NotificationsDrawer = ({ tasksPath = "/tasks" }) => {
    const notifications = useNotifications();
    const navigate = useNavigate();
    const desktop = useMediaQuery("(min-width: 768px)");
    const open = Boolean(notifications?.inboxOpen);
    const close = notifications?.closeInbox;
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [onlyUnread, setOnlyUnread] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(
        async (nextPage = 1, signal) => {
            setLoading(true);
            setError(null);
            try {
                const data = await listNotifications({ unread: onlyUnread, page: nextPage, perPage: PER_PAGE }, { signal });
                const list = Array.isArray(data?.items) ? data.items : [];
                setItems((prev) => (nextPage === 1 ? list : [...prev, ...list]));
                setTotal(Number(data?.total) || 0);
                setPage(nextPage);
                if (typeof data?.unread === "number") notifications?.setUnread(data.unread);
            } catch (err) {
                if (toApiError(err).kind !== "cancelled") setError(err);
            } finally {
                if (!signal?.aborted) setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [onlyUnread]
    );

    useEffect(() => {
        if (!open) return undefined;
        const controller = new AbortController();
        load(1, controller.signal);
        return () => controller.abort();
    }, [open, load]);

    if (!notifications) return null;

    const openItem = async (item) => {
        if (!item.readAt) {
            setItems((list) => list.map((n) => (n._id === item._id ? { ...n, readAt: new Date().toISOString() } : n)));
            notifications.setUnread((n) => Math.max(0, n - 1));
            markRead(item._id).catch(() => notifications.refresh());
        }
        if (item.taskId) {
            close();
            navigate(`${tasksPath}/${encodeURIComponent(item.taskId)}`);
        }
    };

    const readAll = async () => {
        setBusy(true);
        try {
            await markAllRead();
            const now = new Date().toISOString();
            setItems((list) => (onlyUnread ? [] : list.map((n) => (n.readAt ? n : { ...n, readAt: now }))));
            notifications.setUnread(0);
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    };

    const unreadHere = items.some((n) => !n.readAt);
    const firstLoad = loading && !items.length;

    return (
        <Drawer
            opened={open}
            onClose={close}
            position="right"
            size={desktop ? 420 : "100%"}
            radius={desktop ? "lg" : 0}
            padding={0}
            scrollAreaComponent={ScrollArea.Autosize}
            title={
                <Group gap="xs">
                    <Text fw={600} size="md">
                        Notifications
                    </Text>
                    {notifications.unread ? (
                        <Badge color="red" variant="filled" size="sm" circle={notifications.unread < 10}>
                            {notifications.unread > 99 ? "99+" : notifications.unread}
                        </Badge>
                    ) : null}
                </Group>
            }
            classNames={{ header: "inbox__header", body: "inbox__body" }}
            styles={{ header: { padding: "calc(10px + var(--safe-top)) 12px 10px 16px" } }}
            closeButtonProps={{ "aria-label": "Close notifications" }}
        >
            <Group gap="xs" wrap="nowrap" px="md" py="xs" className="inbox__tools">
                <SegmentedControl
                    value={onlyUnread ? "unread" : "all"}
                    onChange={(v) => setOnlyUnread(v === "unread")}
                    data={[
                        { value: "all", label: "All" },
                        { value: "unread", label: `Unread${notifications.unread ? ` (${notifications.unread})` : ""}` },
                    ]}
                    aria-label="Show"
                    style={{ flex: 1 }}
                />
                <Tooltip label="Mark all read">
                    <ActionIcon
                        onClick={readAll}
                        loading={busy}
                        disabled={!unreadHere && !notifications.unread}
                        aria-label="Mark all read"
                        variant="light"
                        color="gold"
                    >
                        <IconChecks size={18} stroke={1.75} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            <div className="inbox__list">
                {error ? (
                    <Alert color="red" m="md" icon={<Icon name="alert" size={16} />} role="alert">
                        <Text size="sm">{friendlyMessage(error)}</Text>
                        {isRetryable(error) || toApiError(error).kind === "http" ? (
                            <Button size="xs" variant="light" color="red" mt="xs" onClick={() => load(1)}>
                                Retry
                            </Button>
                        ) : null}
                    </Alert>
                ) : null}

                {firstLoad ? (
                    <div aria-label="Loading notifications">
                        <RowSkeleton />
                        <RowSkeleton />
                        <RowSkeleton />
                        <RowSkeleton />
                    </div>
                ) : null}

                {!loading && !error && !items.length ? (
                    <Stack gap={6} align="center" ta="center" py={48} px="lg">
                        <ThemeIcon size={52} radius="xl" variant="light" color="gold">
                            <Icon name="bell" size={24} />
                        </ThemeIcon>
                        <Text fw={600} size="sm" mt={4}>
                            {onlyUnread ? "You're all caught up" : "No notifications yet"}
                        </Text>
                        <Text size="xs" c="dimmed" maw={260}>
                            New assignments, update requests and comments on your tasks appear here.
                        </Text>
                    </Stack>
                ) : null}

                <ul className="inbox__items">
                    {items.map((n) => {
                        const [icon, color] = KINDS[n.kind] || ["bell", "gray"];
                        return (
                            <li key={n._id}>
                                <UnstyledButton className={`inbox-row ${n.readAt ? "" : "is-unread"}`} onClick={() => openItem(n)}>
                                    <ThemeIcon size={36} radius="xl" variant="light" color={color}>
                                        <Icon name={icon} size={17} />
                                    </ThemeIcon>
                                    <span className="inbox-row__text">
                                        <Text size="sm" fw={n.readAt ? 500 : 600} lineClamp={1} component="span" className="inbox-row__title">
                                            {n.taskNumber && !String(n.title || "").includes(`#${n.taskNumber}`) ? (
                                                <span className="inbox-row__num">#{n.taskNumber} </span>
                                            ) : null}
                                            {n.title}
                                        </Text>
                                        {n.body ? (
                                            <Text size="xs" c="dimmed" lineClamp={1} component="span">
                                                {n.body}
                                            </Text>
                                        ) : null}
                                        <Text size="xs" c="dimmed" component="span" className="inbox-row__meta">
                                            {[n.actorName, relativeTime(n.createdAt)].filter(Boolean).join(" · ")}
                                        </Text>
                                    </span>
                                    {!n.readAt ? <span className="inbox-row__dot" aria-label="Unread" /> : null}
                                </UnstyledButton>
                            </li>
                        );
                    })}
                </ul>

                {loading && items.length ? <RowSkeleton /> : null}
                {!loading && items.length < total ? (
                    <Button variant="subtle" fullWidth my="sm" onClick={() => load(page + 1)}>
                        Load more
                    </Button>
                ) : null}
            </div>
        </Drawer>
    );
};

export default NotificationsDrawer;
