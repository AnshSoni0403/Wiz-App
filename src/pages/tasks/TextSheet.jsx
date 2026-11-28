import { Alert, Button, Group, Stack, Text, TextInput, Textarea } from "@mantine/core";
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
    placeholder = "",
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

    const Field = multiline ? Textarea : TextInput;

    return (
        <Sheet
            open={open}
            title={title}
            onClose={onClose}
            busy={busy}
            size="md"
            footer={
                <Group grow>
                    <Button variant="default" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="submit" form={fieldId} loading={busy} disabled={required && !text.trim()}>
                        {submitLabel}
                    </Button>
                </Group>
            }
        >
            <form id={fieldId} onSubmit={submit}>
                <Stack gap="sm">
                    {error ? (
                        <Alert color="red" icon={<Icon name="alert" size={16} />}>
                            {friendlyMessage(error)}
                        </Alert>
                    ) : null}
                    <Field
                        label={label}
                        data-autofocus
                        type={multiline ? undefined : type}
                        minRows={multiline ? 3 : undefined}
                        maxLength={maxLength}
                        value={text}
                        required={required}
                        placeholder={placeholder}
                        onChange={(e) => setText(e.target.value)}
                    />
                    {hint ? (
                        <Text size="xs" c="dimmed">
                            {hint}
                        </Text>
                    ) : null}
                    {extra}
                </Stack>
            </form>
        </Sheet>
    );
};

export default TextSheet;
