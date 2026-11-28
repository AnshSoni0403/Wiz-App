import { Alert, Anchor, Badge, Button, Code, CopyButton, Drawer, Group, Modal, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useState } from "react";
import Icon from "../Icon";
import SettingsRow from "./SettingsRow";
import { useAuth } from "../../context/AuthContext";
import { createTelegramCode, unlinkTelegram } from "../../api/wizz.api";
import { friendlyMessage } from "../../utils/errors";
import { countdown } from "../../utils/format";

const POLL_MS = 5000;
const BOT_RE = /^[A-Za-z0-9_]{3,64}$/;

const cleanBot = (value) => {
    const bot = String(value || "").trim().replace(/^@/, "");
    return BOT_RE.test(bot) ? bot : "";
};

/**
 * Telegram settings row + sheet. POST /wizz/me/telegram-code returns a single-use code the user sends to
 * the bot as "link <CODE>". While the code is valid we re-check /wizz/me to detect the link.
 */
const TelegramLinkCard = () => {
    const { wizz, refreshWizz } = useAuth();
    const desktop = useMediaQuery("(min-width: 768px)");
    const linked = Boolean(wizz?.member?.telegram?.linked);
    const username = wizz?.member?.telegram?.username;

    const [open, setOpen] = useState(false);
    const [code, setCode] = useState(null); // { code, expiresAt, botUsername }
    const [now, setNow] = useState(Date.now());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [confirmUnlink, setConfirmUnlink] = useState(false);

    const expiresAt = code ? new Date(code.expiresAt).getTime() : 0;
    const msLeft = code ? expiresAt - now : 0;
    const expired = Boolean(code) && (!Number.isFinite(msLeft) || msLeft <= 0);
    const bot = cleanBot(code?.botUsername || wizz?.telegramBotUsername);

    useEffect(() => {
        if (!code || expired) return undefined;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [code, expired]);

    useEffect(() => {
        if (!code || expired || linked) return undefined;
        const id = setInterval(() => {
            if (document.visibilityState === "visible" && navigator.onLine) refreshWizz().catch(() => {});
        }, POLL_MS);
        return () => clearInterval(id);
    }, [code, expired, linked, refreshWizz]);

    useEffect(() => {
        if (linked && code) {
            setCode(null);
            notifications.show({ message: "Telegram linked.", color: "teal", icon: <Icon name="check" size={16} /> });
        }
    }, [linked, code]);

    const requestCode = useCallback(async () => {
        setBusy(true);
        setError("");
        try {
            const data = await createTelegramCode();
            setCode(data);
            setNow(Date.now());
        } catch (err) {
            setError(friendlyMessage(err));
        } finally {
            setBusy(false);
        }
    }, []);

    const unlink = useCallback(async () => {
        setBusy(true);
        setError("");
        try {
            await unlinkTelegram();
            await refreshWizz();
            setConfirmUnlink(false);
            notifications.show({ message: "Telegram unlinked.", color: "teal", icon: <Icon name="check" size={16} /> });
        } catch (err) {
            setError(friendlyMessage(err));
        } finally {
            setBusy(false);
        }
    }, [refreshWizz]);

    const checkNow = async () => {
        setBusy(true);
        setError("");
        try {
            const me = await refreshWizz();
            if (!me?.member?.telegram?.linked) setError("Not linked yet. Send the message to the bot, then check again.");
        } catch (err) {
            setError(friendlyMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const close = () => {
        setOpen(false);
        setConfirmUnlink(false);
        setError("");
    };

    const content = (
        <Stack gap="md">
            {linked ? (
                <>
                    <Group gap="sm" wrap="nowrap">
                        <ThemeIcon size={40} radius="xl" variant="light" color="teal">
                            <Icon name="check" size={20} />
                        </ThemeIcon>
                        <div>
                            <Text fw={600} size="sm">
                                Linked{username ? ` as @${username}` : ""}
                            </Text>
                            <Text size="xs" c="dimmed">
                                You can ask Wizz and manage tasks from Telegram.
                            </Text>
                        </div>
                    </Group>
                    {confirmUnlink ? (
                        <Alert color="red" icon={<Icon name="alert" size={16} />}>
                            <Text size="sm">You won't be able to use Wizz from Telegram until you link again.</Text>
                            <Group gap="xs" mt="sm">
                                <Button size="xs" color="red" loading={busy} onClick={unlink}>
                                    Unlink
                                </Button>
                                <Button size="xs" variant="subtle" color="gray" onClick={() => setConfirmUnlink(false)}>
                                    Keep linked
                                </Button>
                            </Group>
                        </Alert>
                    ) : (
                        <Button variant="light" color="red" onClick={() => setConfirmUnlink(true)} fullWidth>
                            Unlink Telegram
                        </Button>
                    )}
                </>
            ) : code && !expired ? (
                <>
                    <Text size="sm">
                        Open{" "}
                        {bot ? (
                            <Anchor href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" fw={600}>
                                @{bot}
                            </Anchor>
                        ) : (
                            "the Wizz bot"
                        )}{" "}
                        in Telegram and send this message:
                    </Text>
                    <Paper withBorder p="sm" radius="md" bg="var(--brand-soft)">
                        <Group justify="space-between" wrap="nowrap">
                            <Code fz="lg" fw={700} bg="transparent">
                                link {code.code}
                            </Code>
                            <CopyButton value={`link ${code.code}`} timeout={2000}>
                                {({ copied, copy }) => (
                                    <Button size="xs" variant={copied ? "light" : "filled"} color={copied ? "teal" : "gold"} onClick={copy} leftSection={<Icon name={copied ? "check" : "copy"} size={14} />}>
                                        {copied ? "Copied" : "Copy"}
                                    </Button>
                                )}
                            </CopyButton>
                        </Group>
                    </Paper>
                    <Group gap={6}>
                        <Icon name="clock" size={14} />
                        <Text size="xs" c="dimmed">
                            Expires in <b>{countdown(msLeft)}</b> · works once
                        </Text>
                    </Group>
                    <Stack gap="xs">
                        {bot ? (
                            <Button component="a" href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" leftSection={<Icon name="telegram" size={16} />} fullWidth>
                                Open Telegram
                            </Button>
                        ) : null}
                        <Button variant="light" onClick={checkNow} loading={busy} fullWidth>
                            I've sent it
                        </Button>
                    </Stack>
                </>
            ) : (
                <>
                    <Text size="sm" c="dimmed">
                        {expired
                            ? "That code has expired. Get a new one to link your Telegram account."
                            : "Link your Telegram account to ask Wizz and manage tasks from Telegram as well."}
                    </Text>
                    <Button onClick={requestCode} loading={busy} leftSection={<Icon name="telegram" size={16} />} fullWidth>
                        {expired ? "Get a new code" : "Get a link code"}
                    </Button>
                </>
            )}
            {error ? (
                <Alert color="red" icon={<Icon name="alert" size={16} />} role="alert" py="xs">
                    {error}
                </Alert>
            ) : null}
        </Stack>
    );

    const title = (
        <Group gap="xs">
            <Icon name="telegram" size={18} />
            <Text fw={600}>Telegram</Text>
        </Group>
    );

    return (
        <>
            <SettingsRow
                icon="telegram"
                iconColor="blue"
                label="Telegram"
                description={linked ? `Linked${username ? ` as @${username}` : ""}` : "Use Wizz from Telegram"}
                right={
                    <Group gap={4} wrap="nowrap">
                        {linked ? (
                            <Badge color="teal" variant="light">
                                Linked
                            </Badge>
                        ) : null}
                        <Icon name="chevron-right" size={16} className="settings-row__chevron" />
                    </Group>
                }
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
            />
            {desktop ? (
                <Modal opened={open} onClose={close} title={title} size="sm">
                    {content}
                </Modal>
            ) : (
                <Drawer opened={open} onClose={close} title={title} position="bottom" size="auto" classNames={{ content: "sheet-content" }}>
                    {content}
                </Drawer>
            )}
        </>
    );
};

export default TelegramLinkCard;
