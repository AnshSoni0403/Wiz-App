import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon";
import { cancelTaskAction, confirmTaskAction, switchTaskActionMode } from "../../api/tasks.api";
import { useNotifications } from "../../context/NotificationsContext";
import { friendlyMessage } from "../../utils/errors";
import { PRIORITY_LABELS } from "../../utils/tasks";

const TASKS_PATH = "/tasks";

const KIND_TITLES = { create: "New task", update: "Change task", status: "Status change" };

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

    return (
        <div className={`task-action task-action--${action.status}`} role="group" aria-label={KIND_TITLES[action.kind] || "Task change"}>
            <div className="task-action__head">
                <Icon name="tasks" size={16} />
                <span>{KIND_TITLES[action.kind] || "Task change"}</span>
                <span className={`task-action__state task-action__state--${action.status}`}>
                    {pending ? "Needs your OK" : action.status === "committed" ? "Saved" : action.status === "cancelled" ? "Cancelled" : "Expired"}
                </span>
            </div>
            {action.summary ? <p className="task-action__summary">{action.summary}</p> : null}
            <dl className="task-action__details">
                {d.title ? (
                    <div>
                        <dt>Task</dt>
                        <dd>{d.title}</dd>
                    </div>
                ) : null}
                {d.team?.name ? (
                    <div>
                        <dt>Team</dt>
                        <dd>
                            {d.team.name}
                            {d.team.branch ? ` (${d.team.branch})` : ""}
                            {d.team.memberCount ? ` · ${d.team.memberCount} member${d.team.memberCount === 1 ? "" : "s"}` : ""}
                        </dd>
                    </div>
                ) : null}
                {people.length ? (
                    <div>
                        <dt>{people.length > 1 ? "People" : "Person"}</dt>
                        <dd>{people.join(", ")}</dd>
                    </div>
                ) : null}
                {d.dueLabel || d.due ? (
                    <div>
                        <dt>Due</dt>
                        <dd>{d.dueLabel || d.due}</dd>
                    </div>
                ) : null}
                {d.priority ? (
                    <div>
                        <dt>Priority</dt>
                        <dd>{PRIORITY_LABELS[d.priority] || d.priority}</dd>
                    </div>
                ) : null}
                {d.changes?.length ? (
                    <div>
                        <dt>Changes</dt>
                        <dd>
                            <ul className="task-action__changes">
                                {d.changes.map((c) => (
                                    <li key={c}>{c}</li>
                                ))}
                            </ul>
                        </dd>
                    </div>
                ) : null}
            </dl>

            {pending && action.canSwitchTeamMode ? (
                <div className="segmented segmented--sm" role="group" aria-label="How to assign the team">
                    {[
                        ["shared", "One shared task"],
                        ["per_member", "One task per member"],
                    ].map(([mode, label]) => (
                        <button
                            key={mode}
                            type="button"
                            aria-pressed={d.teamMode === mode}
                            disabled={Boolean(busy)}
                            onClick={() => d.teamMode !== mode && act("mode", () => switchTaskActionMode(action.id, mode))}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            ) : null}

            {error ? (
                <p className="task-action__error" role="alert">
                    <Icon name="alert" size={14} /> {friendlyMessage(error)}
                </p>
            ) : null}

            {pending ? (
                <div className="row">
                    <button type="button" className="btn btn--primary btn--sm" disabled={Boolean(busy)} onClick={() => act("confirm", () => confirmTaskAction(action.id))}>
                        <Icon name="check" size={16} /> {busy === "confirm" ? "Saving…" : "Confirm"}
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" disabled={Boolean(busy)} onClick={() => act("cancel", () => cancelTaskAction(action.id))}>
                        Cancel
                    </button>
                </div>
            ) : null}

            {action.status === "committed" && ids.length ? (
                <div className="task-chips" aria-label="Saved tasks">
                    {ids.map((id, i) => (
                        <Link key={id} to={`${TASKS_PATH}/${encodeURIComponent(id)}`} className="task-chip">
                            <Icon name="tasks" size={13} /> {numbers[i] ? `#${numbers[i]}` : "Open task"}
                        </Link>
                    ))}
                </div>
            ) : null}
            <span className="sr-only" aria-live="polite">
                {action.status === "committed" ? "Saved." : action.status === "cancelled" ? "Cancelled." : ""}
            </span>
        </div>
    );
};

/** Tasks Wizz talked about in this reply, as tappable chips. */
export const TaskRefs = ({ refs }) => {
    if (!refs?.length) return null;
    return (
        <div className="task-chips" aria-label="Tasks mentioned">
            {refs.map((t) => (
                <Link key={t._id} to={`${TASKS_PATH}/${encodeURIComponent(t._id)}`} className={`task-chip task-chip--${t.status || "open"}`}>
                    {t.number ? <strong>#{t.number}</strong> : <Icon name="tasks" size={13} />}
                    <span className="task-chip__title">{t.title}</span>
                    {t.statusLabel ? <span className="task-chip__status">{t.statusLabel}</span> : null}
                </Link>
            ))}
        </div>
    );
};

export default TaskActionCard;
