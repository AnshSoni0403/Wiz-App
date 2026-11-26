import Icon from "../Icon";
import markUrl from "../../assets/images/marwiz-mark.png";

export const STARTER_QUESTIONS = [
    "What server do we need for 60 cameras at 1080p with three detections each?",
    "Send me the ANPR demo video",
    "Which detections suit a jewellery store?",
];

/** Shown to members who may use web research; the server decides when a question needs it. */
export const RESEARCH_EXAMPLE = "What do other companies charge for shop-theft video analytics in Kenya?";

/** Empty-chat welcome with suggested questions. */
const StarterQuestions = ({ name, onPick, disabled = false, research = false }) => {
    const questions = research ? [...STARTER_QUESTIONS, RESEARCH_EXAMPLE] : STARTER_QUESTIONS;
    return (
        <div className="welcome">
            <img src={markUrl} alt="" className="welcome__mark" width="56" height="56" />
            <h2 className="welcome__title">{name ? `Hi ${name}, I'm Wizz` : "Hi, I'm Wizz"}</h2>
            <p className="welcome__text">
                Ask me about Marwiz Vision products, detections, hardware, deployments, pricing and demo material.
                {research ? " If it needs looking up on the web, I'll do that too." : ""}
            </p>
            <div className="starters">
                {questions.map((q) => (
                    <button key={q} type="button" className="starter" onClick={() => onPick(q)} disabled={disabled}>
                        <Icon name="sparkle" size={16} />
                        <span>{q}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default StarterQuestions;
