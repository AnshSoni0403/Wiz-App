import Icon from "../Icon";
import Markdown from "../Markdown";
import { branchName } from "../../utils/format";
import { safeHref } from "../../utils/markdown";
import { friendlyMessage, isRetryable } from "../../utils/errors";

const MEDIA_ICONS = { video: "video", image: "image", document: "document" };
const KIND_LABELS = { drive: "Google Drive", file: "File", external: "Link" };

/** Citation chips: "title · branch · v#". */
const Citations = ({ citations, branches }) => {
    if (!citations?.length) return null;
    return (
        <div className="citations" aria-label="Sources">
            {citations.map((c, i) => (
                <span key={`${c.itemId || c.title}-${i}`} className="citation" title={c.title}>
                    <Icon name={MEDIA_ICONS[c.type] || "book"} size={13} />
                    <span className="citation__title">{c.title}</span>
                    {c.branch ? <span className="citation__meta">· {branchName(c.branch, branches)}</span> : null}
                    {c.version ? <span className="citation__meta">· v{c.version}</span> : null}
                </span>
            ))}
        </div>
    );
};

/** Video / document / image links; open in a new tab. */
const MediaCards = ({ media }) => {
    if (!media?.length) return null;
    return (
        <div className="media-list">
            {media.map((m, i) => {
                const href = m.url ? safeHref(m.url) && m.url : null;
                const icon = MEDIA_ICONS[m.type] || "link";
                const body = (
                    <>
                        {m.type === "image" && href ? (
                            <img className="media-card__thumb" src={href} alt="" loading="lazy" />
                        ) : (
                            <span className={`media-card__icon media-card__icon--${icon}`}>
                                <Icon name={icon} size={22} />
                            </span>
                        )}
                        <span className="media-card__text">
                            <span className="media-card__title">{m.title || "Untitled"}</span>
                            {m.atLabel ? (
                                <span className="media-card__at">
                                    <Icon name="video" size={12} /> {m.atLabel}
                                </span>
                            ) : null}
                            <span className="media-card__kind">
                                {[m.type, KIND_LABELS[m.kind]].filter(Boolean).join(" · ")}
                            </span>
                        </span>
                        {href ? <Icon name="external" size={16} className="media-card__open" /> : null}
                    </>
                );
                return href ? (
                    <a
                        key={`${m.itemId || m.url}-${i}`}
                        className="media-card"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {body}
                    </a>
                ) : (
                    <div key={`${m.itemId || m.title}-${i}`} className="media-card is-disabled">
                        {body}
                    </div>
                );
            })}
        </div>
    );
};

export const UserMessage = ({ message, onRetry, retryDisabled }) => (
    <div className="msg msg--user">
        <div className="bubble bubble--user">{message.text}</div>
        {message.status === "failed" ? (
            <div className="msg__error" role="alert">
                <Icon name="alert" size={14} />
                <span>{friendlyMessage(message.error)}</span>
                {isRetryable(message.error) ? (
                    <button type="button" className="link-btn" onClick={() => onRetry(message)} disabled={retryDisabled}>
                        Retry
                    </button>
                ) : null}
            </div>
        ) : null}
    </div>
);

export const AssistantMessage = ({ message, branches }) => (
    <div className="msg msg--assistant">
        <div className="bubble bubble--assistant">
            <Markdown text={message.text || ""} />
            <MediaCards media={message.media} />
            <Citations citations={message.citations} branches={branches} />
            {message.gapLogged ? (
                <div className="gap-note">
                    <Icon name="info" size={13} /> Logged for the content team
                </div>
            ) : null}
        </div>
    </div>
);

export const TypingIndicator = () => (
    <div className="msg msg--assistant" aria-live="polite">
        <div className="bubble bubble--assistant bubble--typing">
            <span className="typing" aria-hidden="true">
                <i />
                <i />
                <i />
            </span>
            <span className="typing__label">Wizz is looking this up…</span>
        </div>
    </div>
);
