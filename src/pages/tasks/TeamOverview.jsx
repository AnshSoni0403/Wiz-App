import { Alert, Avatar, Button, Card, Group, Progress, SimpleGrid, Skeleton, Stack, Text, ThemeIcon, UnstyledButton } from "@mantine/core";
import { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import { getWorkload } from "../../api/tasks.api";
import { friendlyMessage, toApiError } from "../../utils/errors";
import { initials } from "../../utils/format";

const TILES = [
    { key: "open", label: "Open", seg: "open", icon: "progress", color: "gold" },
    { key: "overdue", label: "Overdue", seg: "overdue", icon: "alert", color: "red", alert: true },
    { key: "week", label: "Due this week", seg: "open", icon: "due", color: "blue" },
    { key: "review", label: "To review", seg: "review", icon: "done", color: "teal" },
    { key: "followUp", label: "Follow-ups", seg: "followUp", icon: "flag", color: "orange" },
    { key: "blocked", label: "Blocked", seg: "blocked", icon: "blocked", color: "red", alert: true },
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
        <Stack gap="md">
            <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="xs">
                {TILES.map((t) => {
                    const value = Number(summary?.[t.key]) || 0;
                    const hot = t.alert && value > 0;
                    return (
                        <UnstyledButton key={t.key} className={`tk-kpi ${hot ? "tk-kpi--alert" : ""}`} onClick={() => onOpenList(t.seg)} aria-label={`${t.label}: ${summary ? value : "loading"}`}>
                            <ThemeIcon size={26} radius="md" variant="light" color={hot ? "red" : t.color}>
                                <Icon name={t.icon} size={15} />
                            </ThemeIcon>
                            <span className="tk-kpi__value">{summary ? value : <Skeleton height={18} width={24} />}</span>
                            <span className="tk-kpi__label">{t.label}</span>
                        </UnstyledButton>
                    );
                })}
            </SimpleGrid>

            <section aria-labelledby="workload-title" aria-busy={loading}>
                <Group justify="space-between" mb={6}>
                    <Text id="workload-title" size="xs" c="dimmed" fw={600} tt="uppercase">
                        Workload
                    </Text>
                    {people.length ? (
                        <Text size="xs" c="dimmed">
                            {people.length} {people.length === 1 ? "person" : "people"}
                        </Text>
                    ) : null}
                </Group>
                {error ? (
                    <Alert color="red" icon={<Icon name="alert" size={16} />}>
                        <Text size="sm">{friendlyMessage(error)}</Text>
                        <Button size="xs" variant="light" color="red" mt={6} onClick={() => setRetry((n) => n + 1)}>
                            Retry
                        </Button>
                    </Alert>
                ) : null}
                {loading ? (
                    <Stack gap={6}>
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} height={52} />
                        ))}
                    </Stack>
                ) : null}
                {!loading && !error && !people.length ? (
                    <Text size="sm" c="dimmed">
                        No team members to show yet.
                    </Text>
                ) : null}
                {!loading && people.length ? (
                    <Card padding={0}>
                        {people.map((p, i) => (
                            <UnstyledButton key={p._id} className={`tk-person ${i ? "tk-person--divided" : ""}`} onClick={() => onOpenPerson(p._id)} aria-label={`Show ${p.name}'s open tasks`}>
                                <Avatar size={32} radius="xl" color="gold" variant="light">
                                    {initials(p.name)}
                                </Avatar>
                                <div className="tk-person__main">
                                    <Group justify="space-between" wrap="nowrap" gap="xs">
                                        <Text size="sm" fw={600} truncate>
                                            {p.name}
                                        </Text>
                                        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                                            {p.open || 0} open
                                        </Text>
                                    </Group>
                                    <Progress.Root size={5} mt={5} aria-hidden="true">
                                        <Progress.Section value={((Number(p.overdue) || 0) / maxOpen) * 100} color="red" />
                                        <Progress.Section value={(((Number(p.open) || 0) - (Number(p.overdue) || 0)) / maxOpen) * 100} color="gold" />
                                    </Progress.Root>
                                    <Group gap={8} mt={4} className="tk-meta">
                                        {p.overdue ? <span className="tk-meta__item tk-meta__item--danger">{p.overdue} overdue</span> : null}
                                        {p.blocked ? <span className="tk-meta__item">{p.blocked} blocked</span> : null}
                                        {p.awaitingReview ? <span className="tk-meta__item">{p.awaitingReview} to review</span> : null}
                                        {p.completedThisWeek ? <span className="tk-meta__item tk-meta__item--ok">{p.completedThisWeek} done this week</span> : null}
                                        {p.teams?.length ? <span className="tk-meta__item">{p.teams.join(", ")}</span> : null}
                                    </Group>
                                </div>
                                <Icon name="chevron-right" size={16} className="tk-person__chev" />
                            </UnstyledButton>
                        ))}
                    </Card>
                ) : null}
            </section>
        </Stack>
    );
};

export default TeamOverview;
