import { Button, SegmentedControl, TextInput } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import Icon from "../../components/Icon";
import Sheet from "../../components/Sheet";
import LiveToast from "../../components/LiveToast";
import TaskCard, { TaskCardSkeleton } from "./TaskCard";
import TeamOverview from "./TeamOverview";
import NewTaskSheet from "./NewTaskSheet";
import { getTaskSummary, listTasks, listTeams } from "../../api/tasks.api";
import { useNotifications } from "../../context/NotificationsContext";
import useToast from "../../hooks/useToast";
import { friendlyMessage, isRetryable, toApiError } from "../../utils/errors";
import { PRIORITY_LABELS, STATUS_LABELS, isManagerAccess } from "../../utils/tasks";

const PER_PAGE = 20;

/** My-work segments (scope "mine": assigned to me or shared with my team). */
const MY_SEGMENTS = [
    { key: "todo", label: "To do", quick: "open", count: "open" },
    { key: "updates", label: "Updates asked", quick: "followUp", count: "followUp" },
    { key: "overdue", label: "Overdue", quick: "overdue", count: "overdue" },
    { key: "done", label: "Done", quick: "completed", count: null },
];

/** Team lists (managers): everything the server lets them see. */
const TEAM_VIEWS = [
    { key: "overview", label: "Overview" },
    { key: "review", label: "Awaiting review", quick: "review", count: "review" },
    { key: "overdue", label: "Overdue", quick: "overdue", count: "overdue" },
    { key: "followUp", label: "Follow-ups", quick: "followUp", count: "followUp" },
    { key: "blocked", label: "Blocked", quick: "blocked", count: "blocked" },
    { key: "open", label: "All open", quick: "open", count: "open" },
];

const SCOPES = [
    { value: "mine", label: "Assigned to me" },
    { value: "created", label: "Created by me" },
    { value: "watching", label: "Watching" },
    { value: "all", label: "Everything I can see" },
];

const SORTS = [
    { value: "", label: "Recommended" },
    { value: "dueDate:asc", label: "Due date (soonest)" },
    { value: "createdAt:desc", label: "Newest" },
    { value: "priority:desc", label: "Priority" },
];

const emptyText = (segment, filtered) => {
    if (filtered) return { title: "No tasks match", body: "Try another search or clear the filters." };
    switch (segment) {
        case "updates":
            return { title: "No update requests", body: "When your manager asks for an update it shows here." };
        case "overdue":
            return { title: "Nothing overdue", body: "You're on top of your deadlines." };
        case "done":
            return { title: "No finished tasks yet", body: "Tasks you complete are kept here with their history." };
        case "review":
            return { title: "Nothing waiting for review", body: "Completed team tasks that need your check appear here." };
        case "followUp":
            return { title: "No open follow-ups", body: "Update requests you've sent appear here until answered." };
        case "blocked":
            return { title: "Nothing blocked", body: "Blocked tasks appear here with the reason." };
        default:
            return { title: "No tasks to do", body: "New assignments appear here and in your notifications." };
    }
};

/**
 * Task lists: "My tasks" segments for everyone; managers get a "Team" view with counts, workload
 * and review queues. Search, filters and "Load more" pagination; state kept in the URL.
 */
const TaskListScreen = ({ access, basePath }) => {
    const manager = isManagerAccess(access);
    const [params, setParams] = useSearchParams();
    const mode = manager && params.get("view") === "team" ? "team" : "mine";
    const segment = params.get("seg") || (mode === "team" ? "overview" : "todo");
    const teamId = params.get("team") || "";
    const assignee = params.get("assignee") || "";
    const [q, setQ] = useState(params.get("q") || "");
    const [query, setQuery] = useState(params.get("q") || "");
    const [filters, setFilters] = useState({ status: "", priority: "", scope: "mine", sort: "" });
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [draftFilters, setDraftFilters] = useState(filters);
    const [newOpen, setNewOpen] = useState(false);

    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [summary, setSummary] = useState(null);
    const [teams, setTeams] = useState([]);
    const [reloadKey, setReloadKey] = useState(0);
    const [toast, showToast, clearToast] = useToast();
    const notifications = useNotifications();
    const seq = useRef(0);

    const setParam = (patch) => {
        const next = new URLSearchParams(params);
        for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || v === "") next.delete(k);
            else next.set(k, v);
        }
        setParams(next, { replace: true });
    };

    // Debounced search.
    useEffect(() => {
        const t = window.setTimeout(() => {
            setQuery(q.trim());
            setParam({ q: q.trim() });
        }, 350);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    useEffect(() => {
        if (!manager) return undefined;
        const controller = new AbortController();
        listTeams({ signal: controller.signal })
            .then((list) => setTeams(Array.isArray(list) ? list.filter((t) => t.active !== false) : []))
            .catch(() => {});
        return () => controller.abort();
    }, [manager]);

    const segments = mode === "team" ? TEAM_VIEWS : MY_SEGMENTS;
    const current = segments.find((s) => s.key === segment) || segments[0];
    const showList = !(mode === "team" && current.key === "overview");

    const baseQuery = useMemo(() => {
        const [sorton, sortdir] = (filters.sort || "").split(":");
        const scope = mode === "team" ? "all" : filters.scope || "mine";
        return {
            scope,
            quick: current.quick,
            status: filters.status,
            priority: filters.priority,
            teamId: mode === "team" ? teamId : "",
            assignee: mode === "team" ? assignee : "",
            q: query,
            sorton,
            sortdir,
        };
    }, [mode, current.quick, filters, teamId, assignee, query]);

    // Summary counts for the segment labels.
    useEffect(() => {
        const controller = new AbortController();
        const sumQuery = mode === "team" ? { scope: "all", teamId } : { scope: filters.scope || "mine" };
        getTaskSummary(sumQuery, { signal: controller.signal })
            .then(setSummary)
            .catch(() => {});
        return () => controller.abort();
    }, [mode, teamId, filters.scope, reloadKey]);

    const load = useCallback(
        async (nextPage = 1) => {
            const run = ++seq.current;
            if (nextPage === 1) setLoading(true);
            else setLoadingMore(true);
            setError(null);
            try {
                const data = await listTasks({ ...baseQuery, page: nextPage, per_page: PER_PAGE });
                if (run !== seq.current) return;
                const list = Array.isArray(data?.items) ? data.items : [];
                setItems((prev) => (nextPage === 1 ? list : [...prev, ...list.filter((t) => !prev.some((p) => p._id === t._id))]));
                setTotal(Number(data?.total) || 0);
                setPage(nextPage);
            } catch (err) {
                if (run !== seq.current || toApiError(err).kind === "cancelled") return;
                setError(err);
            } finally {
                if (run === seq.current) {
                    setLoading(false);
                    setLoadingMore(false);
                }
            }
        },
        [baseQuery]
    );

    useEffect(() => {
        if (!showList) {
            setLoading(false);
            return;
        }
        load(1);
    }, [load, showList, reloadKey]);

    const refreshAll = () => {
        setReloadKey((k) => k + 1);
        notifications?.refresh();
    };

    const filtered = Boolean(query || filters.status || filters.priority || (mode === "mine" && filters.scope !== "mine") || assignee);
    const activeFilterCount = [filters.status, filters.priority, filters.sort, mode === "mine" && filters.scope !== "mine" ? "x" : ""].filter(
        Boolean
    ).length;
    const empty = emptyText(current.key, filtered);
    const countFor = (s) => (s.count && summary && Number(summary[s.count]) ? Number(summary[s.count]) : 0);

    const onCreated = (data) => {
        setNewOpen(false);
        const created = data?.createdTasks?.length || 1;
        showToast(created > 1 ? `${created} tasks created` : `Task${data?.number ? ` #${data.number}` : ""} created`);
        refreshAll();
    };

    return (
        <div className="page">
            <TopBar title="Tasks">
                <Button unstyled type="button" className="btn btn--primary new-task-btn" onClick={() => setNewOpen(true)} aria-label="New task">
                    <Icon name="plus" size={18} /> <span>New task</span>
                </Button>
            </TopBar>
            <div className="page__body tasks-body">
                <LiveToast toast={toast} onClose={clearToast} />

                {manager ? (
                    <SegmentedControl
                        className="workspace-segments"
                        aria-label="Task view"
                        value={mode}
                        data={[{ value: "mine", label: "My tasks" }, { value: "team", label: "Team" }]}
                        onChange={(view) => setParam(view === "mine"
                            ? { view: null, seg: null, team: null, assignee: null }
                            : { view: "team", seg: null })}
                    />
                ) : null}

                <div className="tasks-toolbar">
                    <TextInput
                        className="tasks-search"
                        type="search"
                        aria-label="Search tasks"
                        placeholder="Search tasks or #number"
                        leftSection={<Icon name="search" size={16} />}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <Button unstyled
                        type="button"
                        className="btn btn--ghost filter-btn"
                        onClick={() => {
                            setDraftFilters(filters);
                            setFiltersOpen(true);
                        }}
                        aria-label={activeFilterCount ? `Filters, ${activeFilterCount} active` : "Filters"}
                    >
                        <Icon name="list" size={18} />
                        <span>Filter</span>
                        {activeFilterCount ? <span className="count-badge count-badge--inline">{activeFilterCount}</span> : null}
                    </Button>
                </div>

                {mode === "team" && teams.length ? (
                    <label className="field team-filter">
                        <span className="sr-only">Team</span>
                        <select className="input" value={teamId} onChange={(e) => setParam({ team: e.target.value })}>
                            <option value="">All teams I manage</option>
                            {teams.map((t) => (
                                <option key={t._id} value={t._id}>
                                    {t.name}
                                    {t.branch ? ` (${t.branch})` : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : null}

                <div className="seg-scroll" role="tablist" aria-label="Task lists">
                    {segments.map((s) => {
                        const count = countFor(s);
                        return (
                            <Button unstyled
                                key={s.key}
                                type="button"
                                role="tab"
                                aria-selected={current.key === s.key}
                                className={`seg-pill ${s.key === "overdue" && count ? "seg-pill--alert" : ""}`}
                                onClick={() => setParam({ seg: s.key, assignee: null })}
                            >
                                {s.label}
                                {count ? <span className="seg-pill__count">{count}</span> : null}
                            </Button>
                        );
                    })}
                </div>

                {assignee && mode === "team" ? (
                    <div className="chip-row">
                        <span className="chip">
                            Filtered to one person
                            <button type="button" className="chip__x" onClick={() => setParam({ assignee: null })} aria-label="Clear person filter">
                                <Icon name="close" size={12} />
                            </button>
                        </span>
                    </div>
                ) : null}

                {!showList ? (
                    <TeamOverview
                        summary={summary}
                        teamId={teamId}
                        reloadKey={reloadKey}
                        onOpenList={(seg) => setParam({ seg })}
                        onOpenPerson={(id) => setParam({ seg: "open", assignee: id })}
                    />
                ) : (
                    <section aria-label={`${current.label} tasks`} aria-busy={loading}>
                        {error ? (
                            <div className="notice notice--danger" role="alert">
                                <Icon name="alert" size={18} />
                                <div>
                                    <p>{friendlyMessage(error)}</p>
                                    {isRetryable(error) || toApiError(error).kind !== "http" || toApiError(error).status >= 500 ? (
                                        <Button unstyled type="button" className="btn btn--secondary btn--sm" onClick={() => load(1)}>
                                            Retry
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                        {loading ? (
                            <div className="task-list">
                                <TaskCardSkeleton />
                                <TaskCardSkeleton />
                                <TaskCardSkeleton />
                                <span className="sr-only" role="status">
                                    Loading tasks…
                                </span>
                            </div>
                        ) : null}

                        {!loading && !error && !items.length ? (
                            <div className="empty-state">
                                <Icon name="tasks" size={32} />
                                <p className="empty-state__title">{empty.title}</p>
                                <p className="muted small">{empty.body}</p>
                                {filtered ? (
                                    <Button unstyled
                                        type="button"
                                        className="btn btn--ghost btn--sm"
                                        onClick={() => {
                                            setQ("");
                                            setFilters({ status: "", priority: "", scope: "mine", sort: "" });
                                            setParam({ assignee: null, q: null });
                                        }}
                                    >
                                        Clear filters
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}

                        {!loading && items.length ? (
                            <div className="task-list">
                                {items.map((t) => (
                                    <TaskCard
                                        key={t._id}
                                        task={t}
                                        to={`${basePath}/${encodeURIComponent(t._id)}`}
                                        showAssignees={mode === "team" || filters.scope !== "mine"}
                                    />
                                ))}
                            </div>
                        ) : null}

                        {!loading && items.length < total ? (
                            <Button unstyled type="button" className="btn btn--ghost btn--block" onClick={() => load(page + 1)} disabled={loadingMore}>
                                {loadingMore ? "Loading…" : `Load more (${total - items.length} more)`}
                            </Button>
                        ) : null}
                    </section>
                )}
            </div>

            <Sheet
                open={filtersOpen}
                title="Filter tasks"
                onClose={() => setFiltersOpen(false)}
                footer={
                    <div className="row row--end">
                        <Button unstyled
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => setDraftFilters({ status: "", priority: "", scope: "mine", sort: "" })}
                        >
                            Reset
                        </Button>
                        <Button unstyled
                            type="button"
                            className="btn btn--primary"
                            onClick={() => {
                                setFilters(draftFilters);
                                setFiltersOpen(false);
                            }}
                        >
                            Show tasks
                        </Button>
                    </div>
                }
            >
                <div className="form">
                    {mode === "mine" ? (
                        <label className="field">
                            <span className="field__label">Show</span>
                            <select
                                className="input"
                                value={draftFilters.scope}
                                onChange={(e) => setDraftFilters({ ...draftFilters, scope: e.target.value })}
                            >
                                {SCOPES.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    <label className="field">
                        <span className="field__label">Status</span>
                        <select
                            className="input"
                            value={draftFilters.status}
                            onChange={(e) => setDraftFilters({ ...draftFilters, status: e.target.value })}
                        >
                            <option value="">Any status</option>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        <span className="field__label">Priority</span>
                        <select
                            className="input"
                            value={draftFilters.priority}
                            onChange={(e) => setDraftFilters({ ...draftFilters, priority: e.target.value })}
                        >
                            <option value="">Any priority</option>
                            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        <span className="field__label">Sort by</span>
                        <select className="input" value={draftFilters.sort} onChange={(e) => setDraftFilters({ ...draftFilters, sort: e.target.value })}>
                            {SORTS.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </Sheet>

            <NewTaskSheet open={newOpen} access={access} onClose={() => setNewOpen(false)} onCreated={onCreated} />
        </div>
    );
};

export default TaskListScreen;
