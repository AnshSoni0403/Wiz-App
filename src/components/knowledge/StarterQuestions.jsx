import Icon from "../Icon";
import markUrl from "../../assets/images/marwiz-mark.png";

export const STARTER_QUESTIONS = [
    "What server do we need for 60 cameras with ANPR and PPE?",
    "Send me the ANPR demo video",
    "Which detections suit a jewellery store?",
];

/** Empty-chat welcome with suggested questions. */
const StarterQuestions = ({ name, onPick, disabled = false }) => (
    <div className="welcome">
        <img src={markUrl} alt="" className="welcome__mark" width="56" height="56" />
        <h2 className="welcome__title">{name ? `Hi ${name}, I'm Wizz` : "Hi, I'm Wizz"}</h2>
        <p className="welcome__text">
            Ask me about Marwiz Vision products, detections, hardware, deployments, pricing and demo material.
        </p>
        <div className="starters">
            {STARTER_QUESTIONS.map((q) => (
                <button key={q} type="button" className="starter" onClick={() => onPick(q)} disabled={disabled}>
                    <Icon name="sparkle" size={16} />
                    <span>{q}</span>
                </button>
            ))}
        </div>
    </div>
);

export default StarterQuestions;
