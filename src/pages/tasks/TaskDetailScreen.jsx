import {
    ActionIcon,
    Alert,
    Anchor,
    Badge,
    Button,
    Card,
    Checkbox,
    Group,
    Image,
    Menu,
    SegmentedControl,
    SimpleGrid,
    Skeleton,
    Spoiler,
    Stack,
    Tabs,
    Text,
    TextInput,
    Textarea,
    ThemeIcon,
    Timeline,
    Title,
} from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import Icon from "../../components/Icon";
import Sheet from "../../components/Sheet";
import LiveToast from "../../components/LiveToast";
import TextSheet from "./TextSheet";
import { AssigneeAvatars, PriorityTag, StatusChip } from "./TaskCard";
import {
    addAttachment,
    addChecklistItem,
    addComment,
    deleteAttachment,
    deleteChecklistItem,
    getTask,
    reviewTask,
    setFollowUp,
    setTaskStatus,
    setWatching,
    updateChecklistItem,
    updateTask,
} from "../../api/tasks.api";
import { useNotifications } from "../../context/NotificationsContext";
import useToast from "../../hooks/useToast";
import { friendlyMessage, isRetryable, toApiError } from "../../utils/errors";
import { relativeTime } from "../../utils/format";
import {
    MAX_ATTACHMENT_BYTES,
    PRIORITY_LABELS,
    actionLabel,
    assigneeNames,
    dateTimeLabel,
    dueLabel,
    fileToBase64,
    formatBytes,
    isReopen,
    needsReason,
    newIdempotencyKey,
    statusLabel,
    todayInput,
} from "../../utils/tasks";

const ACCEPT = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";
const ACTIVITY_ICONS = {
    created: "plus",
    assigned: "users",
    comment: "message",
    status: "refresh",
    edit: "edit",
    follow_up: "flag",
    review: "done",
    checklist: "tasks",
    attachment: "paperclip",
    reminder: "clock",
    escalation: "alert",
    watch: "eye",
};
const ACTIVITY_COLORS = { comment: "gold", follow_up: "orange", review: "teal", escalation: "red", reminder: "blue" };
const STATUS_ICONS = { accepted: "check", in_progress: "start", blocked: "blocked", completed: "done", verified: "done", declined: "close", cancelled: "close" };
/** The next step people most likely want, in order of preference. */
const PRIMARY_ORDER = ["completed", "in_progress", "accepted"];

const isTask = (data) => Boolean(data && typeof data === "object" && data._id);

/**
 * One task: hero summary, follow-up / blocked notices, manager review, then Activity · Checklist · Files.
 * Status actions and the reply box sit in a dock at the bottom; secondary actions live in the ⋯ menu.
 */
const TaskDetailScreen = ({ basePath }) => {
    const { taskId } = useParams();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState("");
    const [sheet, setSheet] = useState(null); // { kind, status? }
    const [tab, setTab] = useState("activity");
    const [comment, setComment] = useState("");
    const [commentKey, setCommentKey] = useState(newIdempotencyKey);
    const [newItem, setNewItem] = useState("");
    const [toast, showToast, clearToast] = useToast();
    const notifications = useNotifications();
    const fileRef = useRef(null);
    const cameraRef = useRef(null);
    const commentRef = useRef(null);

    const load = useCallback(
        async (signal) => {
            setError(null);
            try {
                const data = await getTask(taskId, { signal });
                setTask(data);
            } catch (err) {
                if (toApiError(err).kind !== "cancelled") setError(err);
            } finally {
                if (!signal?.aborted) setLoading(false);
            }
        },
        [taskId]
    );

    useEffect(() => {
        setLoading(true);
        setTask(null);
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load]);

    /** Runs one change, applies the returned task (or reloads), announces the result. */
    const run = async (label, work, success) => {
        setBusy(label);
        clearToast();
        try {
            const data = await work();
            if (isTask(data)) setTask(data);
            else await load();
            if (success) showToast(success);
            notifications?.refresh();
            return data;
        } catch (err) {
            showToast(friendlyMessage(err), "danger");
            throw err;
        } finally {
            setBusy("");
        }
    };

    const quiet = (promise) => promise.catch(() => {});

    if (loading) {
        return (
            <div className="page">
                <TopBar title="Task" back={basePath} />
                <div className="page__body" aria-busy="true">
                    <Card>
                        <Skeleton height={14} width={110} />
                        <Skeleton height={20} width="80%" mt={12} />
                        <Skeleton height={10} width="60%" mt={14} />
                        <Skeleton height={10} width="40%" mt={8} />
                    </Card>
                    <Skeleton height={36} radius="xl" />
                    <Skeleton height={120} />
                    <span className="sr-only" role="status">
                        Loading task
                    </span>
                </div>
            </div>
        );
    }

    if (error || !task) {
        const e = toApiError(error);
        return (
            <div className="page">
                <TopBar title="Task" back={basePath} />
                <div className="page__body">
                    <Alert color="red" icon={<Icon name="alert" size={16} />} title={e.status === 404 ? "Task not found" : "Couldn't load the task"}>
                        <Text size="sm">{e.status === 404 ? "This task doesn't exist or you no longer have access to it." : friendlyMessage(error)}</Text>
                        {isRetryable(error) || e.kind !== "http" ? (
                            <Button size="xs" variant="light" color="red" mt={8} onClick={() => load()} leftSection={<Icon name="refresh" size={14} />}>
                                Retry
                            </Button>
                        ) : null}
                    </Alert>
                </div>
            </div>
        );
    }

    const p = task.permissions || { canManage: task.canManage, isAssignee: task.isAssignee, allowedStatuses: [] };
    const canWork = Boolean(p.canWork || p.isAssignee || p.canManage);
    const open = !["completed", "verified", "cancelled", "declined"].includes(task.status);
    const reviewing = Boolean(p.canReview && task.status === "completed");
    const statusButtons = (p.allowedStatuses || []).filter((s) => s !== task.status && !(reviewing && (s === "verified" || s === "in_progress")));
    const primary = PRIMARY_ORDER.find((s) => statusButtons.includes(s) && !isReopen(task, s)) || (statusButtons.length === 1 ? statusButtons[0] : null);
    const secondary = statusButtons.filter((s) => s !== primary);
    const names = assigneeNames(task);
    const activity = [...(task.activity || [])].sort((a, b) => new Date(a.at) - new Date(b.at));
    const checklist = task.checklist || [];
    const done = checklist.filter((c) => c.done).length;
    const files = task.attachments || [];
    const replyMode = task.needsFollowUp && p.isAssignee;

    const changeStatus = (status) => {
        if (status === "verified" && task.status === "completed") {
            quiet(run("status", () => reviewTask(task._id, "approve"), "Task verified"));
            return;
        }
        if (needsReason(task, status)) {
            setSheet({ kind: "reason", status });
            return;
        }
        quiet(run("status", () => setTaskStatus(task._id, status), `Marked ${actionLabel(task, status).toLowerCase().replace(/^mark /, "")}`));
    };

    const reasonCopy = (status) => {
        if (isReopen(task, status)) return { title: "Reopen task", label: "Why is it being reopened?", submit: "Reopen" };
        if (status === "blocked") return { title: "What's blocking it?", label: "Reason", submit: "Mark blocked" };
        return { title: "Decline task", label: "Why are you declining it?", submit: "Decline" };
    };

    const sendComment = async (e) => {
        e?.preventDefault();
        const message = comment.trim();
        if (!message || busy) return;
        try {
            await run("comment", () => addComment(task._id, message, commentKey), replyMode ? "Update sent" : "Comment added");
            setComment("");
            setCommentKey(newIdempotencyKey());
            setTab("activity");
        } catch {
            // the toast shows the error; the text and key stay for a retry
        }
    };

    const onFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (file.size > MAX_ATTACHMENT_BYTES) {
            showToast(`That file is ${formatBytes(file.size)}. Files can be up to 3 MB.`, "danger");
            return;
        }
        try {
            const dataBase64 = await fileToBase64(file);
            await run("attach", () => addAttachment(task._id, { name: file.name || "photo.jpg", mimeType: file.type || "application/octet-stream", dataBase64 }), "Evidence attached");
            setTab("files");
        } catch {
            // shown
        }
    };

    const toggleItem = (item) => quiet(run(`item-${item._id}`, () => updateChecklistItem(task._id, item._id, { done: !item.done }), item.done ? "Item reopened" : "Item done"));

    const addItem = async (e) => {
        e.preventDefault();
        const text = newItem.trim();
        if (!text) return;
        try {
            await run("item-add", () => addChecklistItem(task._id, text), "Checklist item added");
            setNewItem("");
        } catch {
            // shown
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            showToast("Link copied");
        } catch {
            showToast("Couldn't copy the link", "danger");
        }
    };

    const pickPhoto = () => cameraRef.current?.click();
    const pickFile = () => fileRef.current?.click();
    const pickLink = () => setSheet({ kind: "link" });

    return (
        <div className="page">
            <TopBar title={task.number ? `Task #${task.number}` : "Task"} subtitle={statusLabel(task)} back={basePath}>
                <Menu position="bottom-end" width={230}>
                    <Menu.Target>
                        <ActionIcon color="dark" aria-label="More task actions">
                            <Icon name="more" size={20} />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {!p.isAssignee ? (
                            <Menu.Item
                                leftSection={<Icon name="eye" size={16} />}
                                disabled={Boolean(busy)}
                                onClick={() => quiet(run("watch", () => setWatching(task._id, !p.isWatcher), p.isWatcher ? "Stopped watching" : "Watching this task"))}
                            >
                                {p.isWatcher ? "Stop watching" : "Watch this task"}
                            </Menu.Item>
                        ) : null}
                        {p.canManage && open && !task.needsFollowUp ? (
                            <Menu.Item leftSection={<Icon name="flag" size={16} />} onClick={() => setSheet({ kind: "followup" })}>
                                Request an update
                            </Menu.Item>
                        ) : null}
                        {p.canManage && task.needsFollowUp ? (
                            <Menu.Item leftSection={<Icon name="close" size={16} />} onClick={() => quiet(run("followup", () => setFollowUp(task._id, false), "Request withdrawn"))}>
                                Withdraw update request
                            </Menu.Item>
                        ) : null}
                        {p.canManage ? (
                            <Menu.Item leftSection={<Icon name="edit" size={16} />} onClick={() => setSheet({ kind: "edit" })}>
                                Edit due date &amp; priority
                            </Menu.Item>
                        ) : null}
                        <Menu.Item leftSection={<Icon name="copy" size={16} />} onClick={copyLink}>
                            Copy link
                        </Menu.Item>
                        <Menu.Item leftSection={<Icon name="refresh" size={16} />} onClick={() => quiet(run("reload", () => getTask(task._id)))}>
                            Refresh
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </TopBar>

            <div className="page__body tk-detail">
                <LiveToast toast={toast} onClose={clearToast} />

                <Card padding="md" className="tk-hero">
                    <Group gap={6} wrap="wrap">
                        <StatusChip task={task} />
                        <PriorityTag priority={task.priority} />
                        {task.team?.name ? (
                            <Badge color="gray" leftSection={<Icon name="team" size={11} />}>
                                {task.team.name}
                                {task.assignmentMode === "shared" ? " · shared" : ""}
                            </Badge>
                        ) : null}
                        {task.branch ? (
                            <Badge color="gray" variant="outline">
                                {task.branch}
                            </Badge>
                        ) : null}
                    </Group>
                    <Title order={1} className="tk-hero__title" mt={8}>
                        {task.title}
                    </Title>
                    {task.description ? (
                        <Spoiler maxHeight={66} showLabel="More" hideLabel="Less" mt={4}>
                            <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                                {task.description}
                            </Text>
                        </Spoiler>
                    ) : null}
                    <SimpleGrid cols={2} spacing="xs" verticalSpacing={10} mt="sm" className="tk-facts">
                        <Fact icon="due" label="Due" danger={task.isOverdue}>
                            {dueLabel(task) || "No due date"}
                        </Fact>
                        <Fact icon="users" label={names.length > 1 ? "Assignees" : "Assignee"}>
                            {names.length ? (
                                <Group gap={6} wrap="nowrap">
                                    <AssigneeAvatars task={task} size={20} />
                                    <Text size="sm" truncate>
                                        {names.length > 1 ? `${names.length} people` : names[0]}
                                    </Text>
                                </Group>
                            ) : (
                                "—"
                            )}
                        </Fact>
                        <Fact icon="user" label="Assigned by">
                            {task.createdByName || "—"}
                        </Fact>
                        {task.requiresReview ? (
                            <Fact icon="done" label="Review">
                                {task.verifiedAt ? `Verified${task.reviewedByName ? ` by ${task.reviewedByName}` : ""}` : "Manager checks it"}
                            </Fact>
                        ) : task.watchers?.length ? (
                            <Fact icon="eye" label="Watching">
                                {task.watchers.map((w) => w.employeeName || w.name).join(", ")}
                            </Fact>
                        ) : null}
                    </SimpleGrid>
                    {task.timezone && task.dueTime ? (
                        <Text size="xs" c="dimmed" mt={6}>
                            Times in {task.timezone}
                        </Text>
                    ) : null}
                </Card>

                {task.needsFollowUp ? (
                    <Alert color="orange" icon={<Icon name="flag" size={16} />} title={`${task.followUp?.requestedByName || "Your manager"} asked for an update`}>
                        {task.followUp?.note ? <Text size="sm">“{task.followUp.note}”</Text> : null}
                        <Group gap={6} mt={6}>
                            {task.followUp?.requestedAt ? (
                                <Text size="xs" c="dimmed">
                                    {relativeTime(task.followUp.requestedAt)}
                                </Text>
                            ) : null}
                            {p.isAssignee ? (
                                <Button size="compact-xs" variant="light" color="orange" onClick={() => commentRef.current?.focus()}>
                                    Reply below
                                </Button>
                            ) : null}
                        </Group>
                    </Alert>
                ) : null}

                {task.status === "blocked" && task.blockedReason ? (
                    <Alert color="red" icon={<Icon name="blocked" size={16} />} title="Blocked">
                        <Text size="sm">{task.blockedReason}</Text>
                    </Alert>
                ) : null}
                {task.status === "declined" && task.declinedReason ? (
                    <Alert color="gray" icon={<Icon name="close" size={16} />} title="Declined">
                        <Text size="sm">{task.declinedReason}</Text>
                    </Alert>
                ) : null}

                {reviewing ? (
                    <Card padding="md" className="tk-review" aria-label="Review">
                        <Group gap="sm" wrap="nowrap" align="flex-start">
                            <ThemeIcon color="teal" variant="light" radius="xl" size={34}>
                                <Icon name="done" size={18} />
                            </ThemeIcon>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Text fw={600} size="sm">
                                    Ready for your review
                                </Text>
                                <Text size="xs" c="dimmed">
                                    {names.join(", ") || "The assignee"} marked this done{task.completedAt ? ` ${relativeTime(task.completedAt)}` : ""}. Check the activity and files.
                                </Text>
                            </div>
                        </Group>
                        <Group grow mt="sm">
                            <Button variant="default" disabled={Boolean(busy)} onClick={() => setSheet({ kind: "reviewReopen" })}>
                                Reopen
                            </Button>
                            <Button color="gold" loading={busy === "review"} disabled={Boolean(busy) && busy !== "review"} leftSection={<Icon name="check" size={16} />} onClick={() => quiet(run("review", () => reviewTask(task._id, "approve"), "Task verified"))}>
                                Verify
                            </Button>
                        </Group>
                    </Card>
                ) : null}

                <Tabs value={tab} onChange={(v) => v && setTab(v)} variant="pills" radius="xl" keepMounted={false}>
                    <Tabs.List grow className="tk-tabs">
                        <Tabs.Tab value="activity" leftSection={<Icon name="history" size={15} />}>
                            Activity
                        </Tabs.Tab>
                        <Tabs.Tab value="checklist" leftSection={<Icon name="tasks" size={15} />} rightSection={checklist.length ? <span className="tk-tab-count">{done}/{checklist.length}</span> : null}>
                            Checklist
                        </Tabs.Tab>
                        <Tabs.Tab value="files" leftSection={<Icon name="paperclip" size={15} />} rightSection={files.length ? <span className="tk-tab-count">{files.length}</span> : null}>
                            Files
                        </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="activity" pt="sm">
                        {activity.length ? (
                            <Timeline bulletSize={24} lineWidth={2} color="gold" className="tk-timeline">
                                {activity.map((entry, i) => (
                                    <Timeline.Item
                                        key={entry._id || i}
                                        bullet={<Icon name={ACTIVITY_ICONS[entry.type] || "info"} size={12} />}
                                        color={ACTIVITY_COLORS[entry.type] || "gray"}
                                        title={
                                            <Group gap={6} wrap="nowrap">
                                                <Text size="xs" fw={600} truncate>
                                                    {entry.byName || (entry.byType === "SYSTEM" ? "Wizz" : "Someone")}
                                                </Text>
                                                <Text size="xs" c="dimmed" component="time" dateTime={entry.at} title={dateTimeLabel(entry.at)} style={{ flexShrink: 0 }}>
                                                    {relativeTime(entry.at)}
                                                </Text>
                                            </Group>
                                        }
                                    >
                                        {entry.type === "comment" ? (
                                            <div className="tk-bubble">{entry.message}</div>
                                        ) : (
                                            <Text size="xs" c="dimmed">
                                                {entry.message}
                                            </Text>
                                        )}
                                    </Timeline.Item>
                                ))}
                            </Timeline>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="md">
                                No updates yet.
                            </Text>
                        )}
                    </Tabs.Panel>

                    <Tabs.Panel value="checklist" pt="sm">
                        <Card padding="xs">
                            {checklist.length ? (
                                <Stack gap={2}>
                                    {checklist.map((item) => (
                                        <Group key={item._id} gap="xs" wrap="nowrap" className="tk-check">
                                            <Checkbox
                                                checked={Boolean(item.done)}
                                                disabled={!canWork || Boolean(busy)}
                                                onChange={() => toggleItem(item)}
                                                color="teal"
                                                label={
                                                    <span className={item.done ? "tk-check__done" : ""}>
                                                        {item.text}
                                                        {item.done && item.doneByName ? <Text span size="xs" c="dimmed"> · {item.doneByName}</Text> : null}
                                                    </span>
                                                }
                                                style={{ flex: 1 }}
                                            />
                                            {p.canManage ? (
                                                <ActionIcon size="sm" aria-label={`Remove “${item.text}”`} disabled={Boolean(busy)} onClick={() => quiet(run(`item-del-${item._id}`, () => deleteChecklistItem(task._id, item._id), "Item removed"))}>
                                                    <Icon name="trash" size={14} />
                                                </ActionIcon>
                                            ) : null}
                                        </Group>
                                    ))}
                                </Stack>
                            ) : (
                                <Text size="sm" c="dimmed" ta="center" py="xs">
                                    No checklist yet.
                                </Text>
                            )}
                            {canWork ? (
                                <form onSubmit={addItem}>
                                    <TextInput
                                        mt="xs"
                                        aria-label="New checklist item"
                                        maxLength={300}
                                        value={newItem}
                                        placeholder="Add a step"
                                        onChange={(e) => setNewItem(e.target.value)}
                                        leftSection={<Icon name="plus" size={14} />}
                                        rightSection={
                                            newItem.trim() ? (
                                                <ActionIcon type="submit" size="sm" variant="filled" color="gold" aria-label="Add item" loading={busy === "item-add"}>
                                                    <Icon name="check" size={14} />
                                                </ActionIcon>
                                            ) : null
                                        }
                                    />
                                </form>
                            ) : null}
                        </Card>
                    </Tabs.Panel>

                    <Tabs.Panel value="files" pt="sm">
                        {files.length ? (
                            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                                {files.map((a) => {
                                    const isImage = a.kind !== "link" && String(a.mimeType || "").startsWith("image/");
                                    return (
                                        <Card key={a._id} padding={0} className="tk-file">
                                            <Anchor href={a.url} target="_blank" rel="noopener noreferrer" underline="never" c="inherit" className="tk-file__open">
                                                {isImage ? (
                                                    <Image src={a.url} alt={a.name || "Attached photo"} h={92} fit="cover" loading="lazy" />
                                                ) : (
                                                    <div className="tk-file__icon">
                                                        <Icon name={a.kind === "link" ? "link" : "document"} size={28} />
                                                    </div>
                                                )}
                                                <div className="tk-file__text">
                                                    <Text size="xs" fw={600} truncate>
                                                        {a.name || a.url}
                                                    </Text>
                                                    <Text size="xs" c="dimmed" truncate>
                                                        {[a.kind === "link" ? "Link" : formatBytes(a.size), a.uploadedByName].filter(Boolean).join(" · ")}
                                                    </Text>
                                                </div>
                                            </Anchor>
                                            {(a.canDelete ?? p.canManage) ? (
                                                <ActionIcon
                                                    size="sm"
                                                    variant="white"
                                                    className="tk-file__del"
                                                    aria-label={`Remove ${a.name || "attachment"}`}
                                                    disabled={Boolean(busy)}
                                                    onClick={() => {
                                                        if (window.confirm(`Remove ${a.name || "this attachment"}?`)) {
                                                            quiet(run(`att-${a._id}`, () => deleteAttachment(task._id, a._id), "Attachment removed"));
                                                        }
                                                    }}
                                                >
                                                    <Icon name="trash" size={13} />
                                                </ActionIcon>
                                            ) : null}
                                        </Card>
                                    );
                                })}
                            </SimpleGrid>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="sm">
                                No files yet. Add a photo, document or link as proof of progress.
                            </Text>
                        )}
                        {canWork ? (
                            <Group gap={6} mt="sm">
                                <Button size="xs" variant="light" leftSection={<Icon name="camera" size={14} />} onClick={pickPhoto} disabled={Boolean(busy)}>
                                    Photo
                                </Button>
                                <Button size="xs" variant="light" leftSection={<Icon name="paperclip" size={14} />} onClick={pickFile} disabled={Boolean(busy)}>
                                    File
                                </Button>
                                <Button size="xs" variant="subtle" leftSection={<Icon name="link" size={14} />} onClick={pickLink} disabled={Boolean(busy)}>
                                    Link
                                </Button>
                            </Group>
                        ) : null}
                    </Tabs.Panel>
                </Tabs>
            </div>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
            <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={onFile} />

            {primary || secondary.length || p.canComment !== false ? (
                <div className="tk-dock">
                    {!reviewing && (primary || secondary.length) ? (
                        <Group gap={6} wrap="nowrap" className="tk-dock__actions" aria-label="Status actions">
                            {primary ? (
                                <Button
                                    flex={1}
                                    color="gold"
                                    leftSection={<Icon name={STATUS_ICONS[primary] || "check"} size={16} />}
                                    loading={busy === "status"}
                                    disabled={Boolean(busy) && busy !== "status"}
                                    onClick={() => changeStatus(primary)}
                                >
                                    {actionLabel(task, primary)}
                                </Button>
                            ) : null}
                            {secondary.length ? (
                                <Menu position="top-end" width={210}>
                                    <Menu.Target>
                                        <Button variant="default" flex={primary ? undefined : 1} rightSection={<Icon name="chevron-down" size={14} />} disabled={Boolean(busy)}>
                                            {primary ? "More" : "Change status"}
                                        </Button>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                        {secondary.map((s) => (
                                            <Menu.Item
                                                key={s}
                                                color={s === "cancelled" || s === "declined" ? "red" : undefined}
                                                leftSection={<Icon name={isReopen(task, s) ? "refresh" : STATUS_ICONS[s] || "check"} size={15} />}
                                                onClick={() => changeStatus(s)}
                                            >
                                                {actionLabel(task, s)}
                                            </Menu.Item>
                                        ))}
                                    </Menu.Dropdown>
                                </Menu>
                            ) : null}
                        </Group>
                    ) : null}
                    {p.canComment !== false ? (
                        <form className="tk-composer" onSubmit={sendComment}>
                            {canWork ? (
                                <Menu position="top-start" width={180}>
                                    <Menu.Target>
                                        <ActionIcon size={38} aria-label="Attach evidence" disabled={Boolean(busy)} loading={busy === "attach"}>
                                            <Icon name="paperclip" size={19} />
                                        </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                        <Menu.Item leftSection={<Icon name="camera" size={15} />} onClick={pickPhoto}>
                                            Take a photo
                                        </Menu.Item>
                                        <Menu.Item leftSection={<Icon name="document" size={15} />} onClick={pickFile}>
                                            Upload a file
                                        </Menu.Item>
                                        <Menu.Item leftSection={<Icon name="link" size={15} />} onClick={pickLink}>
                                            Add a link
                                        </Menu.Item>
                                    </Menu.Dropdown>
                                </Menu>
                            ) : null}
                            <Textarea
                                ref={commentRef}
                                aria-label={replyMode ? "Your update" : "Add a comment"}
                                placeholder={replyMode ? "Write your update…" : "Comment or follow-up…"}
                                value={comment}
                                maxLength={2000}
                                minRows={1}
                                maxRows={5}
                                autosize
                                disabled={busy === "comment"}
                                onChange={(e) => setComment(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendComment(e);
                                }}
                                radius="xl"
                                style={{ flex: 1 }}
                            />
                            <ActionIcon type="submit" size={38} radius="xl" variant="filled" color="gold" aria-label="Send" disabled={!comment.trim() || Boolean(busy)} loading={busy === "comment"}>
                                <Icon name="send" size={17} />
                            </ActionIcon>
                        </form>
                    ) : null}
                </div>
            ) : null}

            {sheet?.kind === "reason" ? (
                <TextSheet
                    open
                    title={reasonCopy(sheet.status).title}
                    label={reasonCopy(sheet.status).label}
                    submitLabel={reasonCopy(sheet.status).submit}
                    onClose={() => setSheet(null)}
                    onSubmit={async (reason) => {
                        await run("status", () => setTaskStatus(task._id, sheet.status, reason), isReopen(task, sheet.status) ? "Task reopened" : "Status updated");
                        setSheet(null);
                    }}
                />
            ) : null}
            {sheet?.kind === "reviewReopen" ? (
                <TextSheet
                    open
                    title="Reopen for more work"
                    label="What still needs doing?"
                    submitLabel="Reopen"
                    onClose={() => setSheet(null)}
                    onSubmit={async (note) => {
                        await run("review", () => reviewTask(task._id, "reopen", note), "Task reopened");
                        setSheet(null);
                    }}
                />
            ) : null}
            {sheet?.kind === "followup" ? (
                <TextSheet
                    open
                    title="Request an update"
                    label="Message (optional)"
                    placeholder="e.g. Where are we with the draft?"
                    hint={`${names.join(", ") || "The assignee"} will be notified.`}
                    required={false}
                    submitLabel="Send request"
                    onClose={() => setSheet(null)}
                    onSubmit={async (note) => {
                        await run("followup", () => setFollowUp(task._id, true, note), "Update requested");
                        setSheet(null);
                    }}
                />
            ) : null}
            {sheet?.kind === "link" ? (
                <TextSheet
                    open
                    title="Add a link"
                    label="Link"
                    placeholder="https://…"
                    multiline={false}
                    type="url"
                    maxLength={2000}
                    submitLabel="Add link"
                    onClose={() => setSheet(null)}
                    onSubmit={async (url) => {
                        await run("attach", () => addAttachment(task._id, { url }), "Link added");
                        setSheet(null);
                        setTab("files");
                    }}
                />
            ) : null}
            <EditSheet
                open={sheet?.kind === "edit"}
                task={task}
                onClose={() => setSheet(null)}
                onSave={async (body) => {
                    await run("edit", () => updateTask(task._id, body), "Task updated");
                    setSheet(null);
                }}
            />
        </div>
    );
};

/** One labelled fact in the hero card. */
const Fact = ({ icon, label, danger = false, children }) => (
    <div className="tk-fact">
        <Text size="xs" c="dimmed" className="tk-fact__label">
            <Icon name={icon} size={12} /> {label}
        </Text>
        <Text size="sm" fw={500} c={danger ? "red.7" : undefined} component="div" className="tk-fact__value">
            {children}
        </Text>
    </div>
);

/** Managers: due date, time and priority (reassigning is done in chat or Admin). */
const EditSheet = ({ open, task, onClose, onSave }) => {
    const [due, setDue] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [priority, setPriority] = useState("medium");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return;
        setDue(task?.dueDate ? String(task.dueDate).slice(0, 10) : "");
        setDueTime(task?.dueTime || "");
        setPriority(task?.priority || "medium");
        setNote("");
        setError(null);
    }, [open, task]);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const body = { priority };
        const oldDue = task?.dueDate ? String(task.dueDate).slice(0, 10) : "";
        if (due !== oldDue || (dueTime || "") !== (task?.dueTime || "")) {
            body.due = due || null;
            body.dueTime = due && dueTime ? dueTime : null;
        }
        if (note.trim()) body.note = note.trim();
        try {
            await onSave(body);
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet
            open={open}
            title="Edit task"
            onClose={onClose}
            busy={busy}
            size="md"
            footer={
                <Group grow>
                    <Button variant="default" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="submit" form="edit-task-form" loading={busy}>
                        Save
                    </Button>
                </Group>
            }
        >
            <form id="edit-task-form" onSubmit={submit}>
                <Stack gap="md">
                    {error ? (
                        <Alert color="red" icon={<Icon name="alert" size={16} />}>
                            {friendlyMessage(error)}
                        </Alert>
                    ) : null}
                    <SimpleGrid cols={2} spacing="xs">
                        <TextInput type="date" label="Due date" data-autofocus min={todayInput()} value={due} onChange={(e) => setDue(e.target.value)} />
                        <TextInput type="time" label="Time" value={dueTime} disabled={!due} onChange={(e) => setDueTime(e.target.value)} />
                    </SimpleGrid>
                    {due ? (
                        <Button variant="subtle" size="compact-xs" color="gray" onClick={() => setDue("")} style={{ alignSelf: "flex-start" }}>
                            Clear due date
                        </Button>
                    ) : null}
                    <div>
                        <Text size="sm" fw={500} mb={6}>
                            Priority
                        </Text>
                        <SegmentedControl aria-label="Priority" value={priority} onChange={setPriority} data={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
                    </div>
                    <Textarea label="Note to the assignee (optional)" minRows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                    <Text size="xs" c="dimmed">
                        The assignee is notified when the due date changes.
                    </Text>
                </Stack>
            </form>
        </Sheet>
    );
};

export default TaskDetailScreen;
