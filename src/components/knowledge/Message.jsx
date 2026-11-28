import { Accordion, ActionIcon, Avatar, Badge, Button, CopyButton, Group, Text, Tooltip } from "@mantine/core";
import {
    IconAlertTriangle,
    IconBook2,
    IconCheck,
    IconCopy,
    IconExternalLink,
    IconFile,
    IconInfoCircle,
    IconLink,
    IconPhoto,
    IconRefresh,
    IconVideo,
} from "@tabler/icons-react";
import Markdown from "../Markdown";
import markUrl from "../../assets/images/marwiz-mark.png";
import { branchName } from "../../utils/format";
import { safeHref } from "../../utils/markdown";
import { friendlyMessage, isRetryable } from "../../utils/errors";
import TaskActionCard, { TaskRefs } from "./TaskActionCard";

const MEDIA_ICONS = { video: IconVideo, image: IconPhoto, document: IconFile };
const KIND_LABELS = { drive: "Google Drive", file: "File", external: "Link" };

/** Sources behind an answer, collapsed by default: "Sources (3)". */
const Citations = ({ citations, branches }) => {
    if (!citations?.length) return null;
    return (
        <Accordion variant="unstyled" chevronPosition="right" className="sources">
            <Accordion.Item value="sources">
                <Accordion.Control className="sources__control" icon={<IconBook2 size={14} stroke={1.75} />}>
                    Sources ({citations.length})
                </Accordion.Control>
                <Accordion.Panel>
                    <ul className="sources__list" aria-label="Sources">
                        {citations.map((c, i) => {
                            const CIcon = MEDIA_ICONS[c.type] || IconBook2;
                            return (
                                <li key={`${c.itemId || c.title}-${i}`} className="source" title={c.title}>
                                    <CIcon size={14} stroke={1.75} className="source__icon" />
                                    <span className="source__title">{c.title}</span>
                                    <span className="source__meta">
                                        {[c.branch ? branchName(c.branch, branches) : null, c.version ? `v${c.version}` : null].filter(Boolean).join(" · ")}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>
    );
};

/** Video / document / image links as compact cards; open in a new tab. */
const MediaCards = ({ media }) => {
    if (!media?.length) return null;
    return (
        <div className="media-list">
            {media.map((m, i) => {
                const href = m.url ? safeHref(m.url) && m.url : null;
                const MIcon = MEDIA_ICONS[m.type] || IconLink;
                const body = (
                    <>
                        {m.type === "image" && href ? (
                            <img className="media-card__thumb" src={href} alt="" loading="lazy" />
                        ) : (
                            <span className={`media-card__icon media-card__icon--${m.type || "link"}`}>
                                <MIcon size={20} stroke={1.75} />
                            </span>
                        )}
                        <span className="media-card__text">
                            <span className="media-card__title">{m.title || "Untitled"}</span>
                            <span className="media-card__kind">
                                {[m.atLabel ? `▶ ${m.atLabel}` : null, m.type, KIND_LABELS[m.kind]].filter(Boolean).join(" · ")}
                            </span>
                        </span>
                        {href ? <IconExternalLink size={16} stroke={1.75} className="media-card__open" /> : null}
                    </>
                );
                return href ? (
                    <a key={`${m.itemId || m.url}-${i}`} className="media-card" href={href} target="_blank" rel="noopener noreferrer">
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
    <div className={`msg msg--user${message.status === "sending" ? " is-sending" : ""}`}>
        <div className="bubble bubble--user">{message.text}</div>
        {message.status === "failed" ? (
            <Group gap={6} className="msg__error" role="alert" wrap="nowrap">
                <IconAlertTriangle size={14} stroke={1.75} />
                <Text size="xs" c="red.7">
                    {friendlyMessage(message.error)}
                </Text>
                {isRetryable(message.error) ? (
                    <Button
                        variant="subtle"
                        color="red"
                        size="compact-xs"
                        leftSection={<IconRefresh size={13} />}
                        onClick={() => onRetry(message)}
                        disabled={retryDisabled}
                    >
                        Retry
                    </Button>
                ) : null}
            </Group>
        ) : null}
    </div>
);

const WizzAvatar = () => (
    <Avatar src={markUrl} size={26} radius="xl" className="msg__avatar" alt="" aria-hidden="true">
        W
    </Avatar>
);

/** `children` render under the reply text (e.g. the research progress card). */
export const AssistantMessage = ({ message, branches, children = null }) => (
    <div className="msg msg--assistant">
        <WizzAvatar />
        <div className="msg__body">
            {message.text ? <Markdown text={message.text} /> : null}
            {children}
            {message.taskAction ? <TaskActionCard action={message.taskAction} /> : null}
            <TaskRefs refs={message.taskRefs} />
            <MediaCards media={message.media} />
            <Citations citations={message.citations} branches={branches} />
            <Group gap={6} className="msg__tools">
                {message.gapLogged ? (
                    <Badge variant="light" color="gray" size="sm" leftSection={<IconInfoCircle size={12} />}>
                        Logged for the content team
                    </Badge>
                ) : null}
                {message.text ? (
                    <CopyButton value={message.text} timeout={1500}>
                        {({ copied, copy }) => (
                            <Tooltip label={copied ? "Copied" : "Copy"} withArrow>
                                <ActionIcon size="sm" variant="subtle" color={copied ? "teal" : "gray"} onClick={copy} aria-label={copied ? "Copied" : "Copy answer"}>
                                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} stroke={1.75} />}
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </CopyButton>
                ) : null}
            </Group>
        </div>
    </div>
);

export const TypingIndicator = () => (
    <div className="msg msg--assistant" aria-live="polite">
        <WizzAvatar />
        <div className="msg__body msg__body--typing">
            <span className="typing" aria-hidden="true">
                <i />
                <i />
                <i />
            </span>
            <Text size="xs" c="dimmed">
                Wizz is thinking…
            </Text>
        </div>
    </div>
);
