import Icon from "../Icon";
import markUrl from "../../assets/images/marwiz-mark.png";

export const STARTER_QUESTIONS = [
    "What server do we need for 60 cameras with ANPR and PPE?",
    "Send me the ANPR demo video",
    "Which detections suit a jewellery store?",
];

/** Prompts that start (or check on) a Research Agent job from chat. */
export const RESEARCH_STARTERS = [
    "Research the top five video analytics competitors in Kenya",
    "Size a server for 60 cameras at 1080p/10 FPS with 3 detections per camera and 30 days retention",
    "What's the status of my research?",
];

const Starter = ({ text, icon, onPick, disabled }) => (
    <button type="button" className="starter" onClick={() => onPick(text)} disabled={disabled}>
        <Icon name={icon} size={16} />
        <span>{text}</span>
    </button>
);

/** Empty-chat welcome with suggested questions (and research prompts for staff). */
const StarterQuestions = ({ name, onPick, disabled = false, research = false }) => (
    <div className="welcome">
        <img src={markUrl} alt="" className="welcome__mark" width="56" height="56" />
        <h2 className="welcome__title">{name ? `Hi ${name}, I'm Wizz` : "Hi, I'm Wizz"}</h2>
        <p className="welcome__text">
            Ask me about Marwiz Vision products, detections, hardware, deployments, pricing and demo material.
            {research ? " I can also research competitors and markets, and size servers." : ""}
        </p>
        <div className="starters">
            {STARTER_QUESTIONS.map((q) => (
                <Starter key={q} text={q} icon="sparkle" onPick={onPick} disabled={disabled} />
            ))}
        </div>
        {research ? (
            <div className="starters starters--research" role="group" aria-labelledby="starters-research-title">
                <h3 id="starters-research-title" className="starters__title">
                    Research
                </h3>
                {RESEARCH_STARTERS.map((q) => (
                    <Starter key={q} text={q} icon="research" onPick={onPick} disabled={disabled} />
                ))}
            </div>
        ) : null}
    </div>
);

export default StarterQuestions;
