import { ActionIcon, Alert, Badge, Button, CloseButton, Collapse, Group, Indicator, ScrollArea, SegmentedControl, Select, Stack, Text, TextInput, ThemeIcon, UnstyledButton } from "@mantine/core";
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
    { key: "updates", label: "Updates asked", quick: "followUp", count: "followUp", icon: "flag" },
    { key: "overdue", label: "Overdue", quick: "overdue", count: "overdue", alert: true },
    { key: "done", label: "Done", quick: "completed", count: null },
];

/** Team lists (managers): everything the server lets them see. */
const TEAM_VIEWS = [
    { key: "overview", label: "Overview" },
    { key: "review", label: "Review", quick: "review", count: "review" },
    { key: "overdue", label: "Overdue", quick: "overdue", count: "overdue", alert: true },
    { key: "followUp", label: "Follow-ups", quick: "followUp", count: "followUp" },
    { key: "blocked", label: "Blocked", quick: "blocked", count: "blocked", alert: true },
    { key: "open", label: "All open", quick: "open", count: "open" },
];

const SCOPES = [
    { value: "mine", label: "Mine" },
    { value: "created", label: "Created by me" },
    { value: "watching", label: "Watching" },
    { value: "all", label: "Everything" },
];

const SORTS = [
    { value: "rec", label: "Recommended" },
    { value: "dueDate:asc", label: "Due date (soonest)" },
    { value: "createdAt:desc", label: "Newest" },
    { value: "priority:desc", label: "Priority" },
];

const NO_FILTERS = { status: "", priority: "", scope: "mine", sort: "" };

const emptyText = (segment, filtered) => {
    if (filtered) return { icon: "search", title: "No tasks match", body: "Try another search or clear the filters." };
    switch (segment) {
        case "updates":
            return { icon: "flag", title: "No update requests", body: "When your manager asks for an update it shows here." };
        case "overdue":
            return { icon: "done", title: "Nothing overdue", body: "You're on top of your deadlines." };
        case "done":
            return { icon: "done", title: "No finished tasks yet", body: "Tasks you complete are kept here with their history." };
        case "review":
            return { icon: "done", title: "Nothing to review", body: "Completed team tasks that need your check appear here." };
        case "followUp":
            return { icon: "flag", title: "No open follow-ups", body: "Update requests you've sent appear here until answered." };
        case "blocked":
            return { icon: "done", title: "Nothing blocked", body: "Blocked tasks appear here with the reason." };
        default:
            return { icon: "tasks", title: "You're all clear", body: "New assignments appear here and in your notifications." };
    }
};

/**
 * Task lists: "My tasks" filters for everyone; managers get a "Team" view with counts, workload and
 * review queues. Search (header), filters (sheet), chip filters with counts, "Load more"; state in the URL.
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
    const [searchOpen, setSearchOpen] = useState(Boolean(params.get("q")));
    const [filters, setFilters] = useState(NO_FILTERS);
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
    const searchRef = useRef(null);

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
        if (searchOpen) window.setTimeout(() => searchRef.current?.focus(), 60);
    }, [searchOpen]);

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

    // Summary counts for the chips and the overview tiles.
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
    const activeFilterCount = [filters.status, filters.priority, filters.sort, mode === "mine" && filters.scope !== "mine" ? "x" : ""].filter(Boolean).length;
    const empty = emptyText(current.key, filtered);
    const countFor = (s) => (s.count && summary && Number(summary[s.count]) ? Number(summary[s.count]) : 0);
    const clearAll = () => {
        setQ("");
        setFilters(NO_FILTERS);
        setParam({ assignee: null, q: null });
    };

    const onCreated = (data) => {
        setNewOpen(false);
        const created = data?.createdTasks?.length || 1;
        showToast(created > 1 ? `${created} tasks created` : `Task${data?.number ? ` #${data.number}` : ""} created`);
        refreshAll();
    };

    const subtitle = mode === "team" ? (teams.find((t) => t._id === teamId)?.name || "Team") : SCOPES.find((s) => s.value === filters.scope)?.label === "Mine" ? "My tasks" : SCOPES.find((s) => s.value === filters.scope)?.label;

    return (
        <div className="page">
            <TopBar title="Tasks" subtitle={subtitle}>
                <ActionIcon
                    color={searchOpen ? "gold" : "dark"}
                    variant={searchOpen ? "light" : "subtle"}
                    onClick={() => {
                        if (searchOpen && q) setQ("");
                        setSearchOpen((v) => !v);
                    }}
                    aria-label={searchOpen ? "Close search" : "Search tasks"}
                    aria-expanded={searchOpen}
                >
                    <Icon name="search" size={19} />
                </ActionIcon>
                <Indicator label={activeFilterCount} disabled={!activeFilterCount} size={15} offset={5} color="gold">
                    <ActionIcon
                        color="dark"
                        onClick={() => {
                            setDraftFilters(filters);
                            setFiltersOpen(true);
                        }}
                        aria-label={activeFilterCount ? `Filters, ${activeFilterCount} active` : "Filters"}
                    >
                        <Icon name="adjust" size={19} />
                    </ActionIcon>
                </Indicator>
            </TopBar>

            <div className="tk-subbar">
                <Collapse in={searchOpen} transitionDuration={150}>
                    <TextInput
                        ref={searchRef}
                        type="search"
                        aria-label="Search tasks"
                        placeholder="Search by title or #number"
                        leftSection={<Icon name="search" size={15} />}
                        rightSection={q ? <CloseButton size="sm" aria-label="Clear search" onClick={() => setQ("")} /> : null}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        mb={8}
                    />
                </Collapse>
                {manager ? (
                    <SegmentedControl
                        aria-label="Task view"
                        value={mode}
                        data={[
                            { value: "mine", label: "Mine" },
                            { value: "team", label: "Team" },
                        ]}
                        onChange={(view) => setParam(view === "mine" ? { view: null, seg: null, team: null, assignee: null } : { view: "team", seg: null })}
                        mb={8}
                    />
                ) : null}
                <ScrollArea type="never" offsetScrollbars={false}>
                    <Group gap={6} wrap="nowrap" role="tablist" aria-label="Task lists" className="tk-chips">
                        {segments.map((s) => {
                            const count = countFor(s);
                            const active = current.key === s.key;
                            return (
                                <UnstyledButton
                                    key={s.key}
                                    role="tab"
                                    aria-selected={active}
                                    className={`tk-chip ${active ? "tk-chip--active" : ""} ${s.alert && count && !active ? "tk-chip--alert" : ""}`}
                                    onClick={() => setParam({ seg: s.key, assignee: null })}
                                >
                                    {s.label}
                                    {count ? <span className="tk-chip__count">{count > 99 ? "99+" : count}</span> : null}
                                </UnstyledButton>
                            );
                        })}
                    </Group>
                </ScrollArea>
                {mode === "team" && teams.length > 1 ? (
                    <Select
                        mt={8}
                        size="xs"
                        aria-label="Team"
                        leftSection={<Icon name="team" size={14} />}
                        data={[{ value: "all", label: "All my teams" }, ...teams.map((t) => ({ value: t._id, label: `${t.name}${t.branch ? ` (${t.branch})` : ""}` }))]}
                        value={teamId || "all"}
                        onChange={(v) => setParam({ team: v && v !== "all" ? v : null })}
                        allowDeselect={false}
                        comboboxProps={{ withinPortal: true }}
                    />
                ) : null}
            </div>

            <div className="page__body tk-body">
                <LiveToast toast={toast} onClose={clearToast} />

                {assignee && mode === "team" ? (
                    <Group gap={6}>
                        <Badge variant="outline" color="gold" rightSection={<CloseButton size="xs" aria-label="Clear person filter" onClick={() => setParam({ assignee: null })} />}>
                            One person's tasks
                        </Badge>
                    </Group>
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
                            <Alert color="red" icon={<Icon name="alert" size={16} />} mb="sm">
                                <Text size="sm">{friendlyMessage(error)}</Text>
                                {isRetryable(error) || toApiError(error).kind !== "http" || toApiError(error).status >= 500 ? (
                                    <Button size="xs" variant="light" color="red" mt={6} onClick={() => load(1)} leftSection={<Icon name="refresh" size={14} />}>
                                        Retry
                                    </Button>
                                ) : null}
                            </Alert>
                        ) : null}

                        {loading ? (
                            <Stack gap="xs">
                                <TaskCardSkeleton />
                                <TaskCardSkeleton />
                                <TaskCardSkeleton />
                                <span className="sr-only" role="status">
                                    Loading tasks…
                                </span>
                            </Stack>
                        ) : null}

                        {!loading && !error && !items.length ? (
                            <Stack align="center" gap={6} className="tk-empty">
                                <ThemeIcon size={52} radius="xl" variant="light" color="gold">
                                    <Icon name={empty.icon} size={26} />
                                </ThemeIcon>
                                <Text fw={600} mt={4}>
                                    {empty.title}
                                </Text>
                                <Text size="sm" c="dimmed" ta="center" maw={280}>
                                    {empty.body}
                                </Text>
                                {filtered ? (
                                    <Button variant="subtle" size="xs" mt={4} onClick={clearAll}>
                                        Clear filters
                                    </Button>
                                ) : null}
                            </Stack>
                        ) : null}

                        {!loading && items.length ? (
                            <Stack gap="xs">
                                {items.map((t) => (
                                    <TaskCard key={t._id} task={t} to={`${basePath}/${encodeURIComponent(t._id)}`} showAssignees={mode === "team" || filters.scope !== "mine"} />
                                ))}
                            </Stack>
                        ) : null}

                        {!loading && items.length < total ? (
                            <Button variant="subtle" fullWidth mt="sm" onClick={() => load(page + 1)} loading={loadingMore}>
                                Load more ({total - items.length})
                            </Button>
                        ) : null}
                    </section>
                )}
                <div className="tk-fab-spacer" aria-hidden="true" />
            </div>

            {access?.enabled !== false ? (
                <ActionIcon className="fab" size={54} radius="xl" variant="filled" color="gold" c="white" style={{ color: "#fff" }} onClick={() => setNewOpen(true)} aria-label="New task">
                    <Icon name="plus" size={24} stroke={2} />
                </ActionIcon>
            ) : null}

            <Sheet
                open={filtersOpen}
                title="Filter tasks"
                onClose={() => setFiltersOpen(false)}
                footer={
                    <Group grow>
                        <Button variant="default" onClick={() => setDraftFilters(NO_FILTERS)}>
                            Reset
                        </Button>
                        <Button
                            onClick={() => {
                                setFilters(draftFilters);
                                setFiltersOpen(false);
                            }}
                        >
                            Show tasks
                        </Button>
                    </Group>
                }
            >
                <Stack gap="md">
                    {mode === "mine" ? (
                        <div>
                            <Text size="xs" fw={600} c="dimmed" mb={6}>
                                SHOW
                            </Text>
                            <SegmentedControl
                                aria-label="Show"
                                value={draftFilters.scope}
                                data={SCOPES}
                                onChange={(scope) => setDraftFilters({ ...draftFilters, scope })}
                                size="xs"
                            />
                        </div>
                    ) : null}
                    <Select
                        label="Status"
                        data={[{ value: "any", label: "Any status" }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
                        value={draftFilters.status || "any"}
                        onChange={(v) => setDraftFilters({ ...draftFilters, status: v && v !== "any" ? v : "" })}
                        allowDeselect={false}
                    />
                    <div>
                        <Text size="xs" fw={600} c="dimmed" mb={6}>
                            PRIORITY
                        </Text>
                        <SegmentedControl
                            aria-label="Priority"
                            value={draftFilters.priority || "any"}
                            data={[{ value: "any", label: "Any" }, ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))]}
                            onChange={(priority) => setDraftFilters({ ...draftFilters, priority: priority === "any" ? "" : priority })}
                            size="xs"
                        />
                    </div>
                    <Select
                        label="Sort by"
                        data={SORTS}
                        value={draftFilters.sort || "rec"}
                        onChange={(v) => setDraftFilters({ ...draftFilters, sort: v && v !== "rec" ? v : "" })}
                        allowDeselect={false}
                    />
                </Stack>
            </Sheet>

            <NewTaskSheet open={newOpen} access={access} onClose={() => setNewOpen(false)} onCreated={onCreated} />
        </div>
    );
};

export default TaskListScreen;
