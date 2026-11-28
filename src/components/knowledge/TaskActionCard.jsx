import { Alert, Badge, Button, Card, Group, SegmentedControl, Text, ThemeIcon } from "@mantine/core";
import { IconAlertTriangle, IconCheck, IconChecklist, IconChevronRight } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cancelTaskAction, confirmTaskAction, switchTaskActionMode } from "../../api/tasks.api";
import { useNotifications } from "../../context/NotificationsContext";
import { friendlyMessage } from "../../utils/errors";
import { PRIORITY_LABELS } from "../../utils/tasks";
import { PRIORITY_COLORS, STATUS_COLORS } from "../../theme";

const TASKS_PATH = "/tasks";

const KIND_TITLES = { create: "New task", update: "Change task", status: "Status change" };
const STATE = {
    pending: { label: "Needs your OK", color: "orange" },
    committed: { label: "Saved", color: "teal" },
    cancelled: { label: "Cancelled", color: "gray" },
    expired: { label: "Expired", color: "gray" },
};

const Row = ({ label, children }) => (
    <div className="task-card__row">
        <Text size="xs" c="dimmed" className="task-card__label">
            {label}
        </Text>
        <div className="task-card__value">{children}</div>
    </div>
);

/**
 * A task change Wizz prepared from the conversation, waiting for the member's confirmation:
 * what will be saved, Confirm / Cancel, and (team assignments) shared vs one task per member.
 * Nothing is saved until Confirm; a second Confirm returns the same result (server-side idempotent).
 */
const TaskActionCard = ({ action: initial }) => {
    const [action, setAction] = useState(initial);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState(null);
    const notifications = useNotifications();

    useEffect(() => setAction(initial), [initial]);

    if (!action?.id) return null;
    const d = action.details || {};
    const pending = action.status === "pending";
    const numbers = action.result?.numbers || [];
    const ids = action.result?.taskIds || [];
    const state = STATE[action.status] || STATE.expired;

    const act = async (label, work) => {
        setBusy(label);
        setError(null);
        try {
            const data = await work();
            if (data?.taskAction) setAction(data.taskAction);
            notifications?.refresh();
        } catch (err) {
            setError(err);
        } finally {
            setBusy("");
        }
    };

    const people = d.assignees?.length ? d.assignees.map((a) => a.name || a.employeeName).filter(Boolean) : [];
    const title = KIND_TITLES[action.kind] || "Task change";

    return (
        <Card className={`task-card task-card--${action.status}`} role="group" aria-label={title} padding="sm">
            <Group gap="xs" wrap="nowrap" mb={6}>
                <ThemeIcon variant="light" color="gold" radius="md" size={26}>
                    <IconChecklist size={15} stroke={1.75} />
                </ThemeIcon>
                <Text fw={600} size="sm" style={{ flex: 1 }}>
                    {title}
                </Text>
                <Badge color={state.color} variant="light">
                    {state.label}
                </Badge>
            </Group>

            {action.summary ? (
                <Text size="sm" mb={8}>
                    {action.summary}
                </Text>
            ) : null}

            <div className="task-card__rows">
                {d.title ? <Row label="Task">{d.title}</Row> : null}
                {d.team?.name ? (
                    <Row label="Team">
                        {d.team.name}
                        {d.team.branch ? ` (${d.team.branch})` : ""}
                        {d.team.memberCount ? ` · ${d.team.memberCount} member${d.team.memberCount === 1 ? "" : "s"}` : ""}
                    </Row>
                ) : null}
                {people.length ? <Row label={people.length > 1 ? "People" : "Person"}>{people.join(", ")}</Row> : null}
                {d.dueLabel || d.due ? <Row label="Due">{d.dueLabel || d.due}</Row> : null}
                {d.priority ? (
                    <Row label="Priority">
                        <Badge color={PRIORITY_COLORS[d.priority] || "gray"} size="sm">
                            {PRIORITY_LABELS[d.priority] || d.priority}
                        </Badge>
                    </Row>
                ) : null}
                {d.changes?.length ? (
                    <Row label="Changes">
                        <ul className="task-card__changes">
                            {d.changes.map((c) => (
                                <li key={c}>{c}</li>
                            ))}
                        </ul>
                    </Row>
                ) : null}
            </div>

            {pending && action.canSwitchTeamMode ? (
                <SegmentedControl
                    mt="xs"
                    aria-label="How to assign the team"
                    value={d.teamMode === "per_member" ? "per_member" : "shared"}
                    disabled={Boolean(busy)}
                    onChange={(mode) => d.teamMode !== mode && act("mode", () => switchTaskActionMode(action.id, mode))}
                    data={[
                        { value: "shared", label: "One shared task" },
                        { value: "per_member", label: "One per member" },
                    ]}
                />
            ) : null}

            {error ? (
                <Alert color="red" mt="xs" p="xs" icon={<IconAlertTriangle size={16} />} role="alert">
                    {friendlyMessage(error)}
                </Alert>
            ) : null}

            {pending ? (
                <Group gap="xs" mt="sm" grow>
                    <Button
                        leftSection={<IconCheck size={16} />}
                        loading={busy === "confirm"}
                        disabled={Boolean(busy) && busy !== "confirm"}
                        onClick={() => act("confirm", () => confirmTaskAction(action.id))}
                    >
                        Confirm
                    </Button>
                    <Button variant="default" disabled={Boolean(busy)} loading={busy === "cancel"} onClick={() => act("cancel", () => cancelTaskAction(action.id))}>
                        Cancel
                    </Button>
                </Group>
            ) : null}

            {action.status === "committed" && ids.length ? (
                <Group gap={6} mt="xs" aria-label="Saved tasks">
                    {ids.map((id, i) => (
                        <Badge
                            key={id}
                            component={Link}
                            to={`${TASKS_PATH}/${encodeURIComponent(id)}`}
                            variant="outline"
                            color="gold"
                            size="md"
                            rightSection={<IconChevronRight size={12} />}
                            className="task-ref"
                        >
                            {numbers[i] ? `Open #${numbers[i]}` : "Open task"}
                        </Badge>
                    ))}
                </Group>
            ) : null}
            <span className="sr-only" aria-live="polite">
                {action.status === "committed" ? "Saved." : action.status === "cancelled" ? "Cancelled." : ""}
            </span>
        </Card>
    );
};

/** Tasks Wizz talked about in this reply, as tappable chips. */
export const TaskRefs = ({ refs }) => {
    if (!refs?.length) return null;
    return (
        <Group gap={6} className="task-refs" aria-label="Tasks mentioned">
            {refs.map((t) => (
                <Badge
                    key={t._id}
                    component={Link}
                    to={`${TASKS_PATH}/${encodeURIComponent(t._id)}`}
                    variant="light"
                    color={STATUS_COLORS[t.status] || "gray"}
                    size="lg"
                    radius="md"
                    className="task-ref"
                    leftSection={t.number ? <strong>#{t.number}</strong> : <IconChecklist size={13} />}
                    title={t.statusLabel ? `${t.title} — ${t.statusLabel}` : t.title}
                >
                    <span className="task-ref__title">{t.title}</span>
                </Badge>
            ))}
        </Group>
    );
};

export default TaskActionCard;
