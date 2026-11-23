import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import Icon from "../../components/Icon";
import BranchPicker from "../../components/knowledge/BranchPicker";
import Composer from "../../components/knowledge/Composer";
import HistoryDrawer from "../../components/knowledge/HistoryDrawer";
import StarterQuestions from "../../components/knowledge/StarterQuestions";
import { AssistantMessage, TypingIndicator, UserMessage } from "../../components/knowledge/Message";
import { useAuth } from "../../context/AuthContext";
import useBranchPreference from "../../hooks/useBranchPreference";
import { getConversation, sendChat } from "../../api/wizz.api";
import { AI_NOT_CONFIGURED_MESSAGE, friendlyMessage, isRetryable, toApiError } from "../../utils/errors";
import { firstName, localId } from "../../utils/format";

const BASE_PATH = "/knowledge";

const fromServerMessage = (m) => ({
    id: localId(),
    role: m.role === "user" ? "user" : "assistant",
    text: m.text || "",
    citations: m.citations || [],
    media: m.media || [],
    at: m.at,
    gapLogged: Boolean(m.gapLogged),
    status: "sent",
});

/**
 * Chat with the Knowledge Base Agent (POST /wizz/chat, channel "pwa").
 * Route: /knowledge (new chat) and /knowledge/:conversationId.
 */
const KnowledgeChatPage = () => {
    const { conversationId: routeId } = useParams();
    const navigate = useNavigate();
    const { wizz, user, refreshWizz } = useAuth();
    const branches = wizz?.branches || [];
    const [branch, setBranch, branchForApi] = useBranchPreference(wizz);

    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);
    const [loadingConversation, setLoadingConversation] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [aiOff, setAiOff] = useState(wizz?.aiConfigured === false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyKey, setHistoryKey] = useState(0);

    const loadedIdRef = useRef(null); // conversation whose messages are in state
    const chatSeqRef = useRef(0);
    const chatAbortRef = useRef(null);
    const scrollRef = useRef(null);
    const composerRef = useRef(null);

    useEffect(() => {
        setAiOff(wizz?.aiConfigured === false);
    }, [wizz?.aiConfigured]);

    const cancelInFlight = () => {
        chatSeqRef.current += 1;
        chatAbortRef.current?.abort();
        chatAbortRef.current = null;
        setSending(false);
    };

    // Load (or reset) the conversation when the route changes.
    const loadConversation = useCallback(async (id, signal) => {
        setLoadingConversation(true);
        setLoadError(null);
        try {
            const conv = await getConversation(id, { signal });
            loadedIdRef.current = id;
            setMessages((conv?.messages || []).map(fromServerMessage));
        } catch (err) {
            if (toApiError(err).kind !== "cancelled") setLoadError(err);
        } finally {
            if (!signal?.aborted) setLoadingConversation(false);
        }
    }, []);

    useEffect(() => {
        const id = routeId || null;
        if (id === loadedIdRef.current) return undefined;
        cancelInFlight();
        if (!id) {
            loadedIdRef.current = null;
            setMessages([]);
            setLoadError(null);
            setLoadingConversation(false);
            return undefined;
        }
        setMessages([]);
        const controller = new AbortController();
        loadConversation(id, controller.signal);
        return () => controller.abort();
    }, [routeId, loadConversation]);

    useEffect(() => () => chatAbortRef.current?.abort(), []);

    // Keep the newest message in view.
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, sending]);

    const runChat = useCallback(
        async (userMessage) => {
            chatAbortRef.current?.abort();
            const controller = new AbortController();
            chatAbortRef.current = controller;
            const seq = ++chatSeqRef.current;
            setSending(true);

            try {
                const data = await sendChat(
                    { conversationId: loadedIdRef.current, message: userMessage.text, branch: branchForApi },
                    { signal: controller.signal }
                );
                if (seq !== chatSeqRef.current) return;
                setAiOff(false);
                const reply = fromServerMessage({ ...(data?.reply || {}), role: "assistant", gapLogged: data?.gapLogged });
                setMessages((list) => [
                    ...list.map((m) => (m.id === userMessage.id ? { ...m, status: "sent", error: null } : m)),
                    reply,
                ]);
                const newId = data?.conversationId;
                if (newId && newId !== loadedIdRef.current) {
                    loadedIdRef.current = newId;
                    navigate(`${BASE_PATH}/${encodeURIComponent(newId)}`, { replace: true });
                    setHistoryKey((k) => k + 1);
                }
            } catch (err) {
                if (seq !== chatSeqRef.current) return;
                const e = toApiError(err);
                if (e.kind === "cancelled" || e.status === 401) return; // 401 -> signed out globally
                if (e.code === "AI_NOT_CONFIGURED") setAiOff(true);
                if (e.code === "WIZZ_NO_ACCESS") {
                    refreshWizz().catch(() => {});
                    return;
                }
                setMessages((list) => list.map((m) => (m.id === userMessage.id ? { ...m, status: "failed", error: e } : m)));
            } finally {
                if (seq === chatSeqRef.current) {
                    setSending(false);
                    chatAbortRef.current = null;
                }
            }
        },
        [branchForApi, navigate, refreshWizz]
    );

    const send = useCallback(
        (text) => {
            if (sending || loadingConversation) return;
            const userMessage = { id: localId(), role: "user", text, at: new Date().toISOString(), status: "sending" };
            setMessages((list) => [...list, userMessage]);
            runChat(userMessage);
        },
        [sending, loadingConversation, runChat]
    );

    const retry = useCallback(
        (message) => {
            if (sending) return;
            setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, status: "sending", error: null } : m)));
            runChat(message);
        },
        [sending, runChat]
    );

    const newChat = useCallback(() => {
        setHistoryOpen(false);
        cancelInFlight();
        loadedIdRef.current = null;
        setMessages([]);
        setLoadError(null);
        navigate(BASE_PATH);
        setTimeout(() => composerRef.current?.focus(), 0);
    }, [navigate]);

    const openConversation = useCallback(
        (id) => {
            setHistoryOpen(false);
            if (id !== loadedIdRef.current) navigate(`${BASE_PATH}/${encodeURIComponent(id)}`);
        },
        [navigate]
    );

    const onDeleted = useCallback(
        (id) => {
            if (id === loadedIdRef.current) {
                cancelInFlight();
                loadedIdRef.current = null;
                setMessages([]);
                navigate(BASE_PATH, { replace: true });
            }
        },
        [navigate]
    );

    const name = firstName(wizz?.member?.name || user?.employeeName || "");
    const empty = !messages.length && !loadingConversation && !loadError;

    return (
        <div className="page page--chat">
            <TopBar
                title="Wizz"
                subtitle="Knowledge"
                leading={
                    <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setHistoryOpen(true)}
                        aria-label="Conversation history"
                    >
                        <Icon name="history" size={22} />
                    </button>
                }
            >
                <BranchPicker branches={branches} value={branch} onChange={setBranch} disabled={sending} />
                <button type="button" className="icon-btn" onClick={newChat} aria-label="New chat">
                    <Icon name="plus" size={22} />
                </button>
            </TopBar>

            <div className="chat-scroll" ref={scrollRef}>
                <div className="chat-thread">
                    {loadingConversation ? <div className="spinner spinner--center" aria-label="Loading conversation" /> : null}

                    {loadError ? (
                        <div className="notice notice--danger">
                            <Icon name="alert" size={18} />
                            <div>
                                <p>{friendlyMessage(loadError)}</p>
                                <div className="row">
                                    {isRetryable(loadError) ? (
                                        <button
                                            type="button"
                                            className="btn btn--secondary btn--sm"
                                            onClick={() => loadConversation(routeId)}
                                        >
                                            Retry
                                        </button>
                                    ) : null}
                                    <button type="button" className="btn btn--ghost btn--sm" onClick={newChat}>
                                        New chat
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {empty ? <StarterQuestions name={name} onPick={send} disabled={sending} /> : null}

                    {messages.map((m) =>
                        m.role === "user" ? (
                            <UserMessage key={m.id} message={m} onRetry={retry} retryDisabled={sending} />
                        ) : (
                            <AssistantMessage key={m.id} message={m} branches={branches} />
                        )
                    )}

                    {sending ? <TypingIndicator /> : null}
                </div>
            </div>

            <div className="chat-footer">
                {aiOff ? (
                    <div className="notice notice--warning small">
                        <Icon name="info" size={16} />
                        <span>{AI_NOT_CONFIGURED_MESSAGE}</span>
                    </div>
                ) : null}
                <Composer ref={composerRef} onSend={send} busy={sending} disabled={loadingConversation} />
            </div>

            <HistoryDrawer
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                activeId={routeId}
                onOpenConversation={openConversation}
                onNewChat={newChat}
                onDeleted={onDeleted}
                refreshKey={historyKey}
            />
        </div>
    );
};

export default KnowledgeChatPage;
