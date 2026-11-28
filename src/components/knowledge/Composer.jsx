import { ActionIcon, Loader, Text, Textarea } from "@mantine/core";
import { IconArrowUp } from "@tabler/icons-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import config from "../../config";

/**
 * Message composer: rounded input with a round send button. Enter sends, Shift+Enter adds a new line,
 * max 4000 characters (the count only appears near the limit).
 */
const Composer = forwardRef(({ onSend, disabled = false, busy = false, placeholder = "Ask Wizz anything…" }, ref) => {
    const [text, setText] = useState("");
    const areaRef = useRef(null);
    const max = config.maxMessageLength;
    const trimmed = text.trim();
    const canSend = !disabled && !busy && trimmed.length > 0 && text.length <= max;

    useImperativeHandle(ref, () => ({
        focus: () => areaRef.current?.focus(),
        setText: (value) => setText(value),
    }));

    const submit = () => {
        if (!canSend) return;
        onSend(trimmed);
        setText("");
    };

    const onKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
        }
    };

    const remaining = max - text.length;

    return (
        <form
            className="composer"
            onSubmit={(e) => {
                e.preventDefault();
                submit();
            }}
        >
            <div className="composer__box">
                <Textarea
                    ref={areaRef}
                    className="composer__input"
                    variant="unstyled"
                    autosize
                    minRows={1}
                    maxRows={6}
                    value={text}
                    maxLength={max}
                    placeholder={placeholder}
                    aria-label="Message"
                    enterKeyHint="send"
                    disabled={disabled}
                    onChange={(e) => setText(e.currentTarget.value.slice(0, max))}
                    onKeyDown={onKeyDown}
                />
                <ActionIcon
                    type="submit"
                    variant="filled"
                    color="gold"
                    radius="xl"
                    size={36}
                    disabled={!canSend}
                    aria-label={busy ? "Wizz is replying" : "Send"}
                    className="composer__send"
                >
                    {busy ? <Loader size={16} color="white" /> : <IconArrowUp size={19} stroke={2.2} />}
                </ActionIcon>
            </div>
            {remaining <= 500 ? (
                <Text size="xs" c={remaining <= 0 ? "red" : "dimmed"} ta="right" className="composer__count" aria-live="polite">
                    {remaining} characters left
                </Text>
            ) : null}
        </form>
    );
});

Composer.displayName = "Composer";

export default Composer;
