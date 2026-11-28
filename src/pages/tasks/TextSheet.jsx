import { Button } from "@mantine/core";
import { useEffect, useId, useState } from "react";
import Sheet from "../../components/Sheet";
import Icon from "../../components/Icon";
import { friendlyMessage } from "../../utils/errors";

/**
 * A sheet asking for one piece of text: a reason (blocked, declined, reopen), a follow-up note, a link.
 * `onSubmit(text)` returns a promise; the sheet stays open and shows the error when it fails.
 */
const TextSheet = ({
    open,
    title,
    label,
    hint = "",
    submitLabel = "Save",
    required = true,
    multiline = true,
    type = "text",
    maxLength = 1000,
    initial = "",
    extra = null,
    onClose,
    onSubmit,
}) => {
    const [text, setText] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const fieldId = useId();

    useEffect(() => {
        if (open) {
            setText(initial);
            setError(null);
        }
    }, [open, initial]);

    const submit = async (e) => {
        e.preventDefault();
        if ((required && !text.trim()) || busy) return;
        setBusy(true);
        setError(null);
        try {
            await onSubmit(text.trim());
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet
            open={open}
            title={title}
            onClose={onClose}
            busy={busy}
            footer={
                <div className="row row--end">
                    <Button unstyled type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button unstyled type="submit" form={fieldId} className="btn btn--primary" disabled={busy || (required && !text.trim())}>
                        {busy ? "Saving…" : submitLabel}
                    </Button>
                </div>
            }
        >
            <form id={fieldId} className="form" onSubmit={submit}>
                {error ? (
                    <div className="notice notice--danger" role="alert">
                        <Icon name="alert" size={16} />
                        <p>{friendlyMessage(error)}</p>
                    </div>
                ) : null}
                <label className="field">
                    <span className="field__label">{label}</span>
                    {multiline ? (
                        <textarea
                            className="input"
                            rows={3}
                            data-autofocus
                            maxLength={maxLength}
                            value={text}
                            required={required}
                            onChange={(e) => setText(e.target.value)}
                        />
                    ) : (
                        <input
                            className="input"
                            type={type}
                            data-autofocus
                            maxLength={maxLength}
                            value={text}
                            required={required}
                            onChange={(e) => setText(e.target.value)}
                        />
                    )}
                </label>
                {hint ? <p className="muted small">{hint}</p> : null}
                {extra}
            </form>
        </Sheet>
    );
};

export default TextSheet;
