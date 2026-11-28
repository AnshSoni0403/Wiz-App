import { Avatar, Badge, Card, Group, Progress, Skeleton, Text, Tooltip } from "@mantine/core";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { PRIORITY_COLORS, STATUS_COLORS } from "../../theme";
import { initials } from "../../utils/format";
import { PRIORITY_LABELS, assigneeNames, dueLabel, statusLabel } from "../../utils/tasks";

/** Status badge with the shared status colours. */
export const StatusChip = ({ task, size = "sm" }) => (
    <Badge color={STATUS_COLORS[task.status] || "gray"} size={size}>
        {statusLabel(task)}
    </Badge>
);

/** Only high and urgent priorities are worth a badge. */
export const PriorityTag = ({ priority, size = "sm" }) =>
    priority === "high" || priority === "urgent" ? (
        <Badge color={PRIORITY_COLORS[priority]} variant={priority === "urgent" ? "filled" : "light"} size={size} leftSection={<Icon name="flag" size={11} />}>
            {PRIORITY_LABELS[priority]}
        </Badge>
    ) : null;

/** Small stacked avatars of the assignees (max 3). */
export const AssigneeAvatars = ({ task, size = 22 }) => {
    const names = assigneeNames(task);
    if (!names.length) return null;
    return (
        <Tooltip label={names.join(", ")} withArrow>
            <Avatar.Group spacing={6}>
                {names.slice(0, 3).map((n) => (
                    <Avatar key={n} size={size} radius="xl" color="gold" variant="light">
                        {initials(n)}
                    </Avatar>
                ))}
                {names.length > 3 ? (
                    <Avatar size={size} radius="xl" color="gray">
                        +{names.length - 3}
                    </Avatar>
                ) : null}
            </Avatar.Group>
        </Tooltip>
    );
};

/** One task in a list; the whole card opens the task. */
const TaskCard = ({ task, to, showAssignees = false }) => {
    const due = dueLabel(task);
    const total = Number(task.checklistTotal) || 0;
    const done = Number(task.checklistDone) || 0;
    return (
        <Card component={Link} to={to} className={`tk-card ${task.isOverdue ? "tk-card--overdue" : ""}`} padding="sm" aria-label={`Task ${task.number ? `#${task.number} ` : ""}${task.title}, ${statusLabel(task)}${due ? `, ${due}` : ""}`}>
            <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
                <div className="tk-card__main">
                    <Group gap={6} wrap="nowrap" className="tk-card__line">
                        {task.number ? <span className="tk-num">#{task.number}</span> : null}
                        <Text component="span" fw={600} size="sm" lineClamp={1} className="tk-card__title">
                            {task.title}
                        </Text>
                    </Group>
                    <Group gap={10} mt={4} className="tk-meta" wrap="wrap">
                        {due ? (
                            <span className={task.isOverdue ? "tk-meta__item tk-meta__item--danger" : "tk-meta__item"}>
                                <Icon name="due" size={13} /> {due}
                            </span>
                        ) : null}
                        {task.team?.name ? (
                            <span className="tk-meta__item">
                                <Icon name="team" size={13} /> {task.team.name}
                            </span>
                        ) : null}
                        {total ? (
                            <span className="tk-meta__item">
                                <Icon name="tasks" size={13} /> {done}/{total}
                            </span>
                        ) : null}
                        {task.commentCount ? (
                            <span className="tk-meta__item">
                                <Icon name="message" size={13} /> {task.commentCount}
                            </span>
                        ) : null}
                        {task.attachmentCount ? (
                            <span className="tk-meta__item">
                                <Icon name="paperclip" size={13} /> {task.attachmentCount}
                            </span>
                        ) : null}
                    </Group>
                </div>
                <div className="tk-card__side">
                    <StatusChip task={task} size="xs" />
                    <Group gap={4} wrap="nowrap" justify="flex-end">
                        {task.needsFollowUp ? (
                            <Tooltip label="Update requested">
                                <span className="tk-flag" aria-label="Update requested">
                                    <Icon name="flag" size={14} />
                                </span>
                            </Tooltip>
                        ) : null}
                        <PriorityTag priority={task.priority} size="xs" />
                        {showAssignees ? <AssigneeAvatars task={task} size={20} /> : null}
                    </Group>
                </div>
            </Group>
            {total ? <Progress value={(done / total) * 100} size={3} mt={8} color="teal" aria-hidden="true" /> : null}
        </Card>
    );
};

export const TaskCardSkeleton = () => (
    <Card padding="sm" aria-hidden="true">
        <Group justify="space-between" wrap="nowrap">
            <div style={{ flex: 1 }}>
                <Skeleton height={12} width="70%" />
                <Skeleton height={9} width="45%" mt={10} />
            </div>
            <Skeleton height={18} width={70} radius="sm" />
        </Group>
    </Card>
);

export default TaskCard;
