import { Button } from "@mantine/core";
import Icon from "../Icon";
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

/** Empty-chat welcome with suggested questions. `tasks` is the member's task role, or null. */
const StarterQuestions = ({ name, onPick, disabled = false, research = false, tasks = null }) => {
    const taskQuestions = tasks ? TASK_EXAMPLES[tasks === "staff" ? "staff" : "manager"] : [];
    const questions = [...taskQuestions, ...STARTER_QUESTIONS.slice(0, tasks ? 2 : 3), ...(research ? [RESEARCH_EXAMPLE] : [])];
    return (
        <div className="welcome">
            <img src={markUrl} alt="" className="welcome__mark" width="56" height="56" />
            <h2 className="welcome__title">{name ? `Hi ${name}, I'm Wizz` : "Hi, I'm Wizz"}</h2>
            <p className="welcome__text">
                Ask me about Marwiz Vision products, detections, hardware, deployments, pricing and demo material.
                {research ? " If it needs looking up on the web, I'll do that too." : ""}
                {tasks
                    ? tasks === "staff"
                        ? " I can also show your tasks and post your updates."
                        : " I can also assign work, chase updates and summarise what your team has done."
                    : ""}
            </p>
            <div className="starters">
                {questions.map((q) => (
                    <Button unstyled key={q} type="button" className="starter" onClick={() => onPick(q)} disabled={disabled}>
                        <Icon name={taskQuestions.includes(q) ? "tasks" : "sparkle"} size={16} />
                        <span>{q}</span>
                    </Button>
                ))}
            </div>
        </div>
    );
};

export default StarterQuestions;
