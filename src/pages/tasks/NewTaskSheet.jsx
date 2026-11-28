import { Alert, Avatar, Button, Checkbox, Group, Loader, Radio, ScrollArea, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Textarea, UnstyledButton } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import Sheet from "../../components/Sheet";
import Icon from "../../components/Icon";
import { createTask, getDirectory } from "../../api/tasks.api";
import { friendlyMessage, toApiError } from "../../utils/errors";
import { initials } from "../../utils/format";
import { PRIORITY_LABELS, newIdempotencyKey, todayInput } from "../../utils/tasks";

const blank = () => ({
    title: "",
    description: "",
    target: "person", // "self" | "person" | "team"
    assigneeIds: [],
    teamId: "",
    teamMode: "shared",
    due: "",
    dueTime: "",
    priority: "medium",
});

const addDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nextFriday = () => {
    const d = new Date();
    const delta = (5 - d.getDay() + 7) % 7 || 7;
    return addDays(delta);
};

/**
 * Quick task creation. People who may assign pick one or more people, or a team with an explicit
 * choice between one shared task and one task per member; staff create tasks for themselves.
 * The idempotency key lives as long as the sheet is open, so a retried save never duplicates.
 */
const NewTaskSheet = ({ open, access, onClose, onCreated }) => {
    const canAssign = Boolean(access?.canAssignOthers || ["owner", "branch_head", "team_lead"].includes(access?.role));
    const selfId = access?.actor?.type === "EMPLOYEE" ? access.actor.id : null;
    const [form, setForm] = useState(blank);
    const [key, setKey] = useState(newIdempotencyKey);
    const [directory, setDirectory] = useState({ people: [], teams: [] });
    const [dirLoading, setDirLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [more, setMore] = useState(false);

    useEffect(() => {
        if (!open) return;
        setForm({ ...blank(), target: canAssign ? "person" : "self" });
        setKey(newIdempotencyKey());
        setError(null);
        setSearch("");
        setMore(false);
    }, [open, canAssign]);

    useEffect(() => {
        if (!open || !canAssign) return undefined;
        const controller = new AbortController();
        const t = window.setTimeout(() => {
            setDirLoading(true);
            getDirectory(search.trim(), { signal: controller.signal })
                .then((data) => setDirectory({ people: data?.people || [], teams: data?.teams || [] }))
                .catch((err) => {
                    if (toApiError(err).kind !== "cancelled") setError(err);
                })
                .finally(() => {
                    if (!controller.signal.aborted) setDirLoading(false);
                });
        }, 250);
        return () => {
            window.clearTimeout(t);
            controller.abort();
        };
    }, [open, canAssign, search]);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const togglePerson = (id) => set({ assigneeIds: form.assigneeIds.includes(id) ? form.assigneeIds.filter((x) => x !== id) : [...form.assigneeIds, id] });
    const selectedTeam = useMemo(() => directory.teams.find((t) => t._id === form.teamId) || null, [directory.teams, form.teamId]);

    const missing = !form.title.trim() || (form.target === "person" && !form.assigneeIds.length) || (form.target === "team" && !form.teamId);

    const submit = async (e) => {
        e.preventDefault();
        if (missing || busy) return;
        setBusy(true);
        setError(null);
        const body = {
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            priority: form.priority,
            due: form.due || undefined,
            dueTime: form.due && form.dueTime ? form.dueTime : undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
            idempotencyKey: key,
        };
        if (form.target === "team") {
            body.teamId = form.teamId;
            body.teamMode = form.teamMode;
        } else if (form.target === "person") {
            body.assigneeIds = form.assigneeIds;
        } else if (selfId) {
            body.assigneeIds = [selfId];
        }
        try {
            const data = await createTask(body);
            onCreated(data);
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    };

    const quickDues = [
        { label: "Today", value: todayInput() },
        { label: "Tomorrow", value: addDays(1) },
        { label: "Friday", value: nextFriday() },
        { label: "Next week", value: addDays(7) },
    ];
    const submitLabel = form.target === "team" && form.teamMode === "per_member" ? `Create ${selectedTeam?.memberCount || ""} tasks`.replace("  ", " ") : "Create task";

    return (
        <Sheet
            open={open}
            title="New task"
            onClose={onClose}
            busy={busy}
            size="lg"
            footer={
                <Button type="submit" form="new-task-form" fullWidth size="md" loading={busy} disabled={missing} leftSection={<Icon name="check" size={18} />}>
                    {submitLabel}
                </Button>
            }
        >
            <form id="new-task-form" onSubmit={submit}>
                <Stack gap="md">
                    {error ? (
                        <Alert color="red" icon={<Icon name="alert" size={16} />}>
                            {friendlyMessage(error)}
                        </Alert>
                    ) : null}

                    <TextInput
                        label="What needs doing?"
                        data-autofocus
                        required
                        maxLength={200}
                        value={form.title}
                        onChange={(e) => set({ title: e.target.value })}
                        placeholder="e.g. Prepare the UK brochure"
                        size="md"
                    />

                    {canAssign ? (
                        <Stack gap={8}>
                            <Text size="sm" fw={500}>
                                Assign to
                            </Text>
                            <SegmentedControl
                                aria-label="Assign to"
                                value={form.target}
                                onChange={(target) => set({ target })}
                                data={[
                                    { value: "person", label: "People" },
                                    { value: "team", label: "Team" },
                                    ...(selfId ? [{ value: "self", label: "Me" }] : []),
                                ]}
                            />
                            {form.target !== "self" ? (
                                <TextInput
                                    aria-label={form.target === "team" ? "Search teams" : "Search people"}
                                    placeholder={form.target === "team" ? "Search teams" : "Search people"}
                                    leftSection={<Icon name="search" size={15} />}
                                    rightSection={dirLoading ? <Loader size={14} /> : null}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    size="xs"
                                />
                            ) : null}
                            {form.target === "person" ? (
                                <ScrollArea.Autosize mah={220} type="auto">
                                    <Stack gap={4} role="group" aria-label="People" aria-busy={dirLoading}>
                                        {directory.people.map((p) => {
                                            const picked = form.assigneeIds.includes(p._id);
                                            return (
                                                <Checkbox.Card key={p._id} className="tk-pick" radius="md" checked={picked} onClick={() => togglePerson(p._id)} aria-label={p.name}>
                                                    <Group wrap="nowrap" gap="sm">
                                                    <Checkbox.Indicator size="xs" />
                                                    <Avatar size={28} radius="xl" color="gold" variant="light">
                                                        {initials(p.name)}
                                                    </Avatar>
                                                    <div className="tk-pick__text">
                                                        <Text size="sm" fw={500} truncate>
                                                            {p.name}
                                                        </Text>
                                                        <Text size="xs" c="dimmed" truncate>
                                                            {[p.branch, ...(p.teams || [])].filter(Boolean).join(" · ")}
                                                        </Text>
                                                    </div>
                                                    </Group>
                                                </Checkbox.Card>
                                            );
                                        })}
                                        {!dirLoading && !directory.people.length ? (
                                            <Text size="xs" c="dimmed">
                                                No one matches.
                                            </Text>
                                        ) : null}
                                    </Stack>
                                </ScrollArea.Autosize>
                            ) : null}
                            {form.target === "team" ? (
                                <>
                                    <ScrollArea.Autosize mah={200} type="auto">
                                        <Radio.Group value={form.teamId} onChange={(teamId) => set({ teamId })} aria-label="Team">
                                            <Stack gap={4} aria-busy={dirLoading}>
                                                {directory.teams.map((t) => (
                                                    <Radio.Card key={t._id} value={t._id} className="tk-pick" radius="md" aria-label={t.name}>
                                                        <Group wrap="nowrap" gap="sm">
                                                        <Radio.Indicator size="xs" />
                                                        <div className="tk-pick__text">
                                                            <Text size="sm" fw={500} truncate>
                                                                {t.name}
                                                                {t.branch ? ` · ${t.branch}` : ""}
                                                            </Text>
                                                            <Text size="xs" c="dimmed" truncate>
                                                                {t.memberCount || 0} member{t.memberCount === 1 ? "" : "s"}
                                                                {t.leads?.length ? ` · lead ${t.leads.map((l) => l.name).join(", ")}` : ""}
                                                            </Text>
                                                        </div>
                                                        </Group>
                                                    </Radio.Card>
                                                ))}
                                                {!dirLoading && !directory.teams.length ? (
                                                    <Text size="xs" c="dimmed">
                                                        No teams you can assign to.
                                                    </Text>
                                                ) : null}
                                            </Stack>
                                        </Radio.Group>
                                    </ScrollArea.Autosize>
                                    {form.teamId ? (
                                        <SimpleGrid cols={2} spacing="xs" role="radiogroup" aria-label="How to assign the team">
                                            {[
                                                { value: "shared", title: "One shared task", body: "The team works on it together." },
                                                {
                                                    value: "per_member",
                                                    title: "One per member",
                                                    body: `${selectedTeam?.memberCount ? `${selectedTeam.memberCount} tasks, ` : ""}each reports alone.`,
                                                },
                                            ].map((o) => (
                                                <UnstyledButton
                                                    key={o.value}
                                                    role="radio"
                                                    aria-checked={form.teamMode === o.value}
                                                    className={`tk-choice ${form.teamMode === o.value ? "tk-choice--on" : ""}`}
                                                    onClick={() => set({ teamMode: o.value })}
                                                >
                                                    <Text size="sm" fw={600}>
                                                        {o.title}
                                                    </Text>
                                                    <Text size="xs" c="dimmed">
                                                        {o.body}
                                                    </Text>
                                                </UnstyledButton>
                                            ))}
                                        </SimpleGrid>
                                    ) : null}
                                </>
                            ) : null}
                        </Stack>
                    ) : (
                        <Group gap={6}>
                            <Icon name="user" size={15} />
                            <Text size="sm" c="dimmed">
                                This task will be assigned to you.
                            </Text>
                        </Group>
                    )}

                    <Stack gap={6}>
                        <Text size="sm" fw={500}>
                            Due
                        </Text>
                        <Group gap={6}>
                            {quickDues.map((d) => (
                                <UnstyledButton key={d.label} className={`tk-chip ${form.due === d.value ? "tk-chip--active" : ""}`} onClick={() => set({ due: form.due === d.value ? "" : d.value })} aria-pressed={form.due === d.value}>
                                    {d.label}
                                </UnstyledButton>
                            ))}
                        </Group>
                        <SimpleGrid cols={2} spacing="xs">
                            <TextInput type="date" aria-label="Due date" min={todayInput()} value={form.due} onChange={(e) => set({ due: e.target.value })} leftSection={<Icon name="due" size={15} />} />
                            <TextInput type="time" aria-label="Due time (optional)" value={form.dueTime} disabled={!form.due} onChange={(e) => set({ dueTime: e.target.value })} leftSection={<Icon name="clock" size={15} />} />
                        </SimpleGrid>
                    </Stack>

                    <Stack gap={6}>
                        <Text size="sm" fw={500}>
                            Priority
                        </Text>
                        <SegmentedControl
                            aria-label="Priority"
                            value={form.priority}
                            onChange={(priority) => set({ priority })}
                            data={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                        />
                    </Stack>

                    {more ? (
                        <Textarea label="Details" minRows={2} maxLength={5000} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Anything the assignee should know" />
                    ) : (
                        <Button variant="subtle" size="xs" leftSection={<Icon name="plus" size={14} />} onClick={() => setMore(true)} style={{ alignSelf: "flex-start" }}>
                            Add details
                        </Button>
                    )}
                </Stack>
            </form>
        </Sheet>
    );
};

export default NewTaskSheet;
