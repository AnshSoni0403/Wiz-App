import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { PRIORITY_LABELS, assigneeSummary, dueLabel, statusLabel } from "../../utils/tasks";

/** Status chip with a colour per state. */
export const StatusChip = ({ task }) => (
    <span className={`status-chip status-chip--${task.status}`}>{statusLabel(task)}</span>
);

export const PriorityTag = ({ priority }) =>
    priority && priority !== "medium" ? (
        <span className={`priority-tag priority-tag--${priority}`}>{PRIORITY_LABELS[priority] || priority}</span>
    ) : null;

/** One task in a list; the whole card opens the task. */
const TaskCard = ({ task, to, showAssignees = false }) => {
    const due = dueLabel(task);
    const total = Number(task.checklistTotal) || 0;
    const done = Number(task.checklistDone) || 0;
    return (
        <Link to={to} className={`task-card ${task.isOverdue ? "is-overdue" : ""}`}>
            <div className="task-card__top">
                {task.number ? <span className="task-num">#{task.number}</span> : null}
                <StatusChip task={task} />
                <PriorityTag priority={task.priority} />
                {task.needsFollowUp ? (
                    <span className="flag-tag">
                        <Icon name="flag" size={12} /> Update requested
                    </span>
                ) : null}
            </div>
            <div className="task-card__title">{task.title}</div>
            <div className="task-card__meta">
                {due ? (
                    <span className={task.isOverdue ? "text-danger" : ""}>
                        <Icon name="clock" size={13} className="inline-icon" /> {due}
                    </span>
                ) : null}
                {task.team?.name ? (
                    <span className="team-badge">
                        <Icon name="users" size={12} /> {task.team.name}
                    </span>
                ) : null}
                {showAssignees && assigneeSummary(task) ? <span>{assigneeSummary(task)}</span> : null}
                {total ? (
                    <span>
                        <Icon name="check" size={13} className="inline-icon" /> {done}/{total}
                    </span>
                ) : null}
                {task.commentCount ? (
                    <span>
                        <Icon name="message" size={13} className="inline-icon" /> {task.commentCount}
                    </span>
                ) : null}
                {task.attachmentCount ? (
                    <span>
                        <Icon name="paperclip" size={13} className="inline-icon" /> {task.attachmentCount}
                    </span>
                ) : null}
            </div>
            {total ? (
                <div className="progress" aria-hidden="true">
                    <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
                </div>
            ) : null}
        </Link>
    );
};

export const TaskCardSkeleton = () => (
    <div className="task-card task-card--skeleton" aria-hidden="true">
        <span className="skeleton skeleton--short" />
        <span className="skeleton" />
        <span className="skeleton skeleton--mid" />
    </div>
);

export default TaskCard;
