import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../Icon";
import { useAuth } from "../../context/AuthContext";
import { createTelegramCode, unlinkTelegram } from "../../api/wizz.api";
import { friendlyMessage } from "../../utils/errors";
import { copyText, countdown } from "../../utils/format";

const POLL_MS = 5000;
const BOT_RE = /^[A-Za-z0-9_]{3,64}$/;

const cleanBot = (value) => {
    const bot = String(value || "").trim().replace(/^@/, "");
    return BOT_RE.test(bot) ? bot : "";
};

/**
 * Link / unlink Telegram. POST /wizz/me/telegram-code returns a single-use code the user sends
 * to the bot as "link <CODE>". While the code is valid we re-check /wizz/me to detect the link.
 */
const TelegramLinkCard = () => {
    const { wizz, refreshWizz } = useAuth();
    const linked = Boolean(wizz?.member?.telegram?.linked);
    const username = wizz?.member?.telegram?.username;

    const [code, setCode] = useState(null); // { code, expiresAt, botUsername }
    const [now, setNow] = useState(Date.now());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef(null);

    const expiresAt = code ? new Date(code.expiresAt).getTime() : 0;
    const msLeft = code ? expiresAt - now : 0;
    const expired = Boolean(code) && (!Number.isFinite(msLeft) || msLeft <= 0);
    const bot = cleanBot(code?.botUsername || wizz?.telegramBotUsername);

    // Countdown tick.
    useEffect(() => {
        if (!code || expired) return undefined;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [code, expired]);

    // Watch for the link to complete while a code is live.
    useEffect(() => {
        if (!code || expired || linked) return undefined;
        const id = setInterval(() => {
            if (document.visibilityState === "visible" && navigator.onLine) refreshWizz().catch(() => {});
        }, POLL_MS);
        return () => clearInterval(id);
    }, [code, expired, linked, refreshWizz]);

    useEffect(() => {
        if (linked) setCode(null);
    }, [linked]);

    useEffect(() => () => clearTimeout(copiedTimer.current), []);

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
        if (!window.confirm("Unlink Telegram? You won't be able to ask Wizz from Telegram until you link again.")) return;
        setBusy(true);
        setError("");
        try {
            await unlinkTelegram();
            await refreshWizz();
        } catch (err) {
            setError(friendlyMessage(err));
        } finally {
            setBusy(false);
        }
    }, [refreshWizz]);

    const copy = async () => {
        if (await copyText(`link ${code.code}`)) {
            setCopied(true);
            clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => setCopied(false), 2000);
        }
    };

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

    return (
        <section className="card">
            <h3 className="card__title">Telegram</h3>

            {linked ? (
                <>
                    <p className="telegram-status">
                        <Icon name="check" size={18} className="text-success" />
                        Linked{username ? ` as @${username}` : ""}. You can ask Wizz from Telegram.
                    </p>
                    <button type="button" className="btn btn--ghost" onClick={unlink} disabled={busy}>
                        Unlink Telegram
                    </button>
                </>
            ) : code && !expired ? (
                <div className="telegram-code">
                    <p>
                        Open{" "}
                        {bot ? (
                            <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer">
                                @{bot}
                            </a>
                        ) : (
                            "the Wizz bot"
                        )}{" "}
                        in Telegram and send:
                    </p>
                    <div className="telegram-code__box">
                        <code>link {code.code}</code>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={copy}>
                            <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copied" : "Copy"}
                        </button>
                    </div>
                    <p className="muted small">
                        Code expires in <strong>{countdown(msLeft)}</strong>. It works once.
                    </p>
                    <div className="row">
                        {bot ? (
                            <a
                                className="btn btn--primary btn--sm"
                                href={`https://t.me/${bot}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Icon name="send" size={16} /> Open Telegram
                            </a>
                        ) : null}
                        <button type="button" className="btn btn--ghost btn--sm" onClick={checkNow} disabled={busy}>
                            I've sent it
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <p className="muted small">
                        {expired
                            ? "That code has expired. Get a new one to link your Telegram account."
                            : "Link your Telegram account to ask Wizz from Telegram as well."}
                    </p>
                    <button type="button" className="btn btn--secondary" onClick={requestCode} disabled={busy}>
                        <Icon name="send" size={18} /> {busy ? "Getting a code…" : expired ? "Get a new code" : "Link Telegram"}
                    </button>
                </>
            )}

            {error ? (
                <div className="alert alert--danger small" role="alert">
                    {error}
                </div>
            ) : null}
        </section>
    );
};

export default TelegramLinkCard;
