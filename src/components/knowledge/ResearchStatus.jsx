import { Button, Group, Paper, Progress, Text, ThemeIcon } from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck, IconRefresh, IconWorldSearch } from "@tabler/icons-react";
import { useEffect } from "react";
import useResearchRun from "../../hooks/useResearchRun";
import { friendlyMessage } from "../../utils/errors";
import { clampPercent, isActiveRun, STAGE_LABELS } from "../../utils/research";

/**
 * Compact progress card under a chat reply while Wizz researches the question on the web.
 * The answer itself arrives as a new message in the same conversation; `onFinished` tells the
 * chat to fetch it once the run is done. `settled` is what the chat already knows about a run
 * that finished: `{ status, phase: "loading" | "missing" }`.
 */
const ResearchStatus = ({ research, settled = null, onFinished, onShowAnswer }) => {
    const { run, error, stopped } = useResearchRun(research.runId, settled?.status || research.status);
    const status = settled?.status || run?.status || research.status;
    const active = isActiveRun(status);

    useEffect(() => {
        if (!settled && status && !isActiveRun(status)) onFinished(research, status);
    }, [settled, status, research, onFinished]);

    let line;
    let detail = null;
    let tone = "gold";
    if (active && stopped) {
        tone = "red";
        line = error?.status === 404 ? "This research is no longer available." : `Couldn't check on this research. ${friendlyMessage(error)}`;
    } else if (active) {
        const progress = run?.progress && typeof run.progress === "object" ? run.progress : {};
        const stage = STAGE_LABELS[progress.stage] || (status === "drafting" ? STAGE_LABELS.drafting : "");
        line = `Researching…${stage ? ` ${stage}` : ""}`;
        detail = error ? "Having trouble checking progress. Still trying…" : "This can take a few minutes. You can keep chatting.";
    } else if (settled?.phase !== "missing") {
        tone = "teal";
        line = "Research done. Getting the answer…";
    } else if (status === "failed") {
        tone = "red";
        line = "Sorry, I couldn't finish this research. Try asking again in a moment.";
    } else if (status === "cancelled") {
        tone = "gray";
        line = "This research was stopped.";
    } else {
        tone = "gray";
        line = "Research done, but the answer hasn't shown up yet.";
    }

    const percent = clampPercent(run?.progress?.percent);
    const showBar = active && !stopped;
    const canShowAnswer = !active && settled?.phase === "missing" && status === "ready";
    const StatusIcon = tone === "red" ? IconAlertTriangle : tone === "teal" ? IconCircleCheck : IconWorldSearch;

    return (
        <Paper withBorder radius="md" p="xs" className="research-card">
            <Group gap="xs" wrap="nowrap" align="flex-start">
                <ThemeIcon variant="light" color={tone} radius="xl" size={28}>
                    <StatusIcon size={16} stroke={1.75} />
                </ThemeIcon>
                <div className="research-card__text">
                    <Text size="sm" fw={500} aria-live="polite" aria-atomic="true">
                        {line}
                    </Text>
                    {showBar ? (
                        <Progress
                            value={percent === null ? 100 : Math.max(percent, 4)}
                            striped={percent === null}
                            animated={percent === null}
                            size="sm"
                            radius="xl"
                            mt={6}
                            aria-label="Research progress"
                        />
                    ) : null}
                    {detail ? (
                        <Text size="xs" c="dimmed" mt={4}>
                            {detail}
                        </Text>
                    ) : null}
                    {canShowAnswer ? (
                        <Button variant="subtle" size="compact-xs" mt={4} leftSection={<IconRefresh size={13} />} onClick={onShowAnswer}>
                            Check again
                        </Button>
                    ) : null}
                </div>
            </Group>
        </Paper>
    );
};

export default ResearchStatus;
