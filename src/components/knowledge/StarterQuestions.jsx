import { SimpleGrid, Text, ThemeIcon, Title, UnstyledButton } from "@mantine/core";
import { IconChecklist, IconDeviceCctv, IconPlayerPlay, IconServer2, IconSparkles, IconWorldSearch } from "@tabler/icons-react";
import markUrl from "../../assets/images/marwiz-mark.png";

export const STARTER_QUESTIONS = [
    "What server do we need for 60 cameras at 1080p with three detections each?",
    "Send me the ANPR demo video",
    "Which detections suit a jewellery store?",
];

/** Shown to members who may use web research; the server decides when a question needs it. */
export const RESEARCH_EXAMPLE = "What do other companies charge for shop-theft video analytics in Kenya?";

/** Task examples by task role (the server decides what each person may actually do). */
export const TASK_EXAMPLES = {
    manager: ["What is pending with my team?", "What did the team complete this week?"],
    staff: ["What's due for me this week?", "Do I have any update requests?"],
};

const ICON_FOR = {
    [STARTER_QUESTIONS[0]]: IconServer2,
    [STARTER_QUESTIONS[1]]: IconPlayerPlay,
    [STARTER_QUESTIONS[2]]: IconDeviceCctv,
    [RESEARCH_EXAMPLE]: IconWorldSearch,
};

/** Empty-chat welcome with suggested questions as cards. `tasks` is the member's task role, or null. */
const StarterQuestions = ({ name, onPick, disabled = false, research = false, tasks = null }) => {
    const taskQuestions = tasks ? TASK_EXAMPLES[tasks === "staff" ? "staff" : "manager"] : [];
    const questions = [...taskQuestions, ...STARTER_QUESTIONS.slice(0, tasks ? 2 : 3), ...(research ? [RESEARCH_EXAMPLE] : [])];
    const abilities = [
        "products, detections, hardware, pricing and demos",
        research ? "web research" : null,
        tasks ? (tasks === "staff" ? "your tasks and updates" : "assigning and tracking your team's work") : null,
    ].filter(Boolean);
    return (
        <div className="welcome">
            <img src={markUrl} alt="" className="welcome__mark" width="48" height="48" />
            <Title order={2} className="welcome__title">
                {name ? `Hi ${name}, how can I help?` : "How can I help?"}
            </Title>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
                Ask me about {abilities.join(", ").replace(/, ([^,]*)$/, " and $1")}.
            </Text>
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs" className="starters">
                {questions.map((q) => {
                    const isTask = taskQuestions.includes(q);
                    const QIcon = isTask ? IconChecklist : ICON_FOR[q] || IconSparkles;
                    return (
                        <UnstyledButton key={q} className="starter" onClick={() => onPick(q)} disabled={disabled}>
                            <ThemeIcon variant="light" color={isTask ? "teal" : "gold"} radius="md" size={30}>
                                <QIcon size={17} stroke={1.75} />
                            </ThemeIcon>
                            <Text size="sm" lh={1.35} className="starter__text">
                                {q}
                            </Text>
                        </UnstyledButton>
                    );
                })}
            </SimpleGrid>
        </div>
    );
};

export default StarterQuestions;
