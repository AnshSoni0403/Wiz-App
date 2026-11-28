import { ActionIcon } from "@mantine/core";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import Icon from "../Icon";
import config from "../../config";

const MAX_HEIGHT_PX = 160;

/**
 * Message composer: Enter sends, Shift+Enter adds a new line, max 4000 characters.
 */
const Composer = forwardRef(({ onSend, disabled = false, busy = false, placeholder = "Ask Wizz…" }, ref) => {
    const [text, setText] = useState("");
    const areaRef = useRef(null);
    const max = config.maxMessageLength;
    const trimmed = text.trim();
    const canSend = !disabled && !busy && trimmed.length > 0 && text.length <= max;

    useImperativeHandle(ref, () => ({
        focus: () => areaRef.current?.focus(),
        setText: (value) => setText(value),
    }));

    useLayoutEffect(() => {
        const el = areaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    }, [text]);

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
            <div className="composer__field">
                <textarea
                    ref={areaRef}
                    className="composer__input"
                    rows={1}
                    value={text}
                    maxLength={max}
                    placeholder={placeholder}
                    aria-label="Message"
                    enterKeyHint="send"
                    disabled={disabled}
                    onChange={(e) => setText(e.target.value.slice(0, max))}
                    onKeyDown={onKeyDown}
                />
                {remaining <= 500 ? (
                    <span className={`composer__count ${remaining <= 0 ? "is-limit" : ""}`}>{remaining}</span>
                ) : null}
            </div>
            <ActionIcon unstyled type="submit" className="composer__send" disabled={!canSend} aria-label="Send">
                <Icon name="send" size={20} />
            </ActionIcon>
        </form>
    );
});

Composer.displayName = "Composer";

export default Composer;
