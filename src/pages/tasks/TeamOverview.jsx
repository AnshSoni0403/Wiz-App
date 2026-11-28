import { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import { getWorkload } from "../../api/tasks.api";
import { friendlyMessage, toApiError } from "../../utils/errors";

const TILES = [
    { key: "open", label: "Open", seg: "open" },
    { key: "overdue", label: "Overdue", seg: "overdue", alert: true },
    { key: "review", label: "Awaiting review", seg: "review" },
    { key: "followUp", label: "Follow-ups", seg: "followUp" },
    { key: "blocked", label: "Blocked", seg: "blocked", alert: true },
    { key: "week", label: "Due this week", seg: "open" },
];

/** Managers' overview: counts that open the matching list, then each person's workload. */
const TeamOverview = ({ summary, teamId, reloadKey, onOpenList, onOpenPerson }) => {
    const [workload, setWorkload] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        getWorkload({ teamId }, { signal: controller.signal })
            .then((data) => setWorkload(data || { people: [], teams: [] }))
            .catch((err) => {
                if (toApiError(err).kind !== "cancelled") setError(err);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [teamId, reloadKey, retry]);

    const people = (workload?.people || []).slice().sort((a, b) => (b.overdue || 0) - (a.overdue || 0) || (b.open || 0) - (a.open || 0));
    const maxOpen = Math.max(1, ...people.map((p) => Number(p.open) || 0));

    return (
        <div className="stack">
            <div className="stat-grid">
                {TILES.map((t) => {
                    const value = Number(summary?.[t.key]) || 0;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            className={`stat-tile ${t.alert && value ? "stat-tile--alert" : ""}`}
                            onClick={() => onOpenList(t.seg)}
                        >
                            <span className="stat-tile__value">{summary ? value : "–"}</span>
                            <span className="stat-tile__label">{t.label}</span>
                        </button>
                    );
                })}
            </div>

            <section className="card" aria-labelledby="workload-title" aria-busy={loading}>
                <h3 className="card__title" id="workload-title">
                    Workload
                </h3>
                {error ? (
                    <div className="notice notice--danger" role="alert">
                        <Icon name="alert" size={16} />
                        <div>
                            <p>{friendlyMessage(error)}</p>
                            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setRetry((n) => n + 1)}>
                                Retry
                            </button>
                        </div>
                    </div>
                ) : null}
                {loading ? <div className="spinner spinner--center" aria-label="Loading workload" /> : null}
                {!loading && !error && !people.length ? <p className="muted small">No team members to show yet.</p> : null}
                {!loading && people.length ? (
                    <ul className="workload-list">
                        {people.map((p) => (
                            <li key={p._id}>
                                <button type="button" className="workload-row" onClick={() => onOpenPerson(p._id)}>
                                    <span className="workload-row__name">
                                        {p.name}
                                        {p.teams?.length ? <span className="muted small"> · {p.teams.join(", ")}</span> : null}
                                    </span>
                                    <span className="workload-bar" aria-hidden="true">
                                        <span style={{ width: `${Math.round(((Number(p.open) || 0) / maxOpen) * 100)}%` }} />
                                    </span>
                                    <span className="workload-row__stats">
                                        <span>{p.open || 0} open</span>
                                        {p.overdue ? <span className="text-danger">{p.overdue} overdue</span> : null}
                                        {p.blocked ? <span>{p.blocked} blocked</span> : null}
                                        {p.awaitingReview ? <span>{p.awaitingReview} to review</span> : null}
                                        {p.completedThisWeek ? <span className="text-success">{p.completedThisWeek} done this week</span> : null}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </section>
        </div>
    );
};

export default TeamOverview;
