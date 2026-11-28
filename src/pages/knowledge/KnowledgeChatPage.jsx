import { ActionIcon, Button } from "@mantine/core";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import Icon from "../../components/Icon";
import BranchPicker from "../../components/knowledge/BranchPicker";
import Composer from "../../components/knowledge/Composer";
import HistoryDrawer from "../../components/knowledge/HistoryDrawer";
import StarterQuestions from "../../components/knowledge/StarterQuestions";
import { AssistantMessage, TypingIndicator, UserMessage } from "../../components/knowledge/Message";
import ResearchStatus from "../../components/knowledge/ResearchStatus";
import { useAuth } from "../../context/AuthContext";
import useBranchPreference from "../../hooks/useBranchPreference";
import { getConversation, sendChat } from "../../api/wizz.api";
import { AI_NOT_CONFIGURED_MESSAGE, friendlyMessage, isRetryable, toApiError } from "../../utils/errors";
import { firstName, localId } from "../../utils/format";
import { answeredResearch, isActiveRun, isAnswered, normaliseChatResearch } from "../../utils/research";
import { canUseResearch, canUseTasks, taskRoleOf } from "../../agents/access";

const BASE_PATH = "/knowledge";
// After a research run finishes, the server posts the answer into the conversation. If it isn't
// there yet when we look, look again after these delays before giving up.
const ANSWER_RETRY_MS = [3000, 6000, 10000];

const fromServerMessage = (m) => ({
    id: localId(),
    role: m.role === "user" ? "user" : "assistant",
    text: m.text || "",
    citations: m.citations || [],
    media: m.media || [],
    at: m.at,
    gapLogged: Boolean(m.gapLogged),
    // Web research behind this reply: { jobId, runId, reportId, status, title }, or null.
    research: normaliseChatResearch(m.research),
    // A task change waiting for confirmation (or already confirmed), and tasks the reply mentions.
    taskAction: m.taskAction && typeof m.taskAction === "object" && m.taskAction.id ? m.taskAction : null,
    taskRefs: Array.isArray(m.taskRefs) ? m.taskRefs.filter((t) => t && t._id) : [],
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
    // Research runs seen to finish here: runId -> { status, phase: "loading" | "missing" }.
    const [settledRuns, setSettledRuns] = useState(() => new Map());

    const loadedIdRef = useRef(null); // conversation whose messages are in state
    const chatSeqRef = useRef(0);
    const chatAbortRef = useRef(null);
    const settledRef = useRef(new Map());
    const answerTimerRef = useRef(null);
    const answerAbortRef = useRef(null);
    const scrollRef = useRef(null);
    const composerRef = useRef(null);

    useEffect(() => {
        setAiOff(wizz?.aiConfigured === false);
    }, [wizz?.aiConfigured]);

    const setSettled = (runId, value) => {
        if (value) settledRef.current.set(runId, value);
        else settledRef.current.delete(runId);
        setSettledRuns(new Map(settledRef.current));
    };

    const cancelInFlight = () => {
        chatSeqRef.current += 1;
        chatAbortRef.current?.abort();
        chatAbortRef.current = null;
        setSending(false);
        // Stop waiting for research answers of the conversation we are leaving; if it is opened
        // again, its still-running research is followed afresh.
        window.clearTimeout(answerTimerRef.current);
        answerAbortRef.current?.abort();
        answerAbortRef.current = null;
        for (const [runId, value] of settledRef.current) {
            if (value.phase === "loading") settledRef.current.delete(runId);
        }
        setSettledRuns(new Map(settledRef.current));
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

    useEffect(
        () => () => {
            chatAbortRef.current?.abort();
            answerAbortRef.current?.abort();
            window.clearTimeout(answerTimerRef.current);
        },
        []
    );

    /**
     * Re-reads the open conversation to pick up research answers the server has posted, keeping
     * any message the user couldn't send. Waits while a chat request is in flight so the two
     * don't overwrite each other, and retries a few times when an answer isn't there yet.
     */
    const fetchResearchAnswers = useCallback(async function fetchAnswers(attempt = 0) {
        window.clearTimeout(answerTimerRef.current);
        answerAbortRef.current?.abort();
        const id = loadedIdRef.current;
        if (!id) return;
        const later = (delay, nextAttempt) => {
            answerTimerRef.current = window.setTimeout(() => fetchAnswers(nextAttempt), delay);
        };
        if (chatAbortRef.current) {
            later(2000, attempt);
            return;
        }

        const controller = new AbortController();
        answerAbortRef.current = controller;
        let next = null;
        try {
            const conv = await getConversation(id, { signal: controller.signal });
            next = (conv?.messages || []).map(fromServerMessage);
        } catch (err) {
            if (toApiError(err).kind === "cancelled") return;
        }
        if (controller.signal.aborted || id !== loadedIdRef.current) return;
        answerAbortRef.current = null;
        if (chatAbortRef.current) {
            later(2000, attempt); // a message went out meanwhile; its reply isn't in `next`
            return;
        }

        if (next) {
            setMessages((list) => [...next, ...list.filter((m) => m.role === "user" && m.status === "failed")]);
        }
        const answered = next ? answeredResearch(next) : new Set();
        const waiting = [...settledRef.current].filter(
            ([runId, value]) => value.phase === "loading" && !isAnswered({ runId, jobId: value.jobId }, answered)
        );
        if (!waiting.length) return;
        if (attempt < ANSWER_RETRY_MS.length) {
            later(ANSWER_RETRY_MS[attempt], attempt + 1);
            return;
        }
        for (const [runId, value] of waiting) settledRef.current.set(runId, { ...value, phase: "missing" });
        setSettledRuns(new Map(settledRef.current));
    }, []);

    const onResearchFinished = useCallback(
        (research, status) => {
            if (!research.runId || settledRef.current.has(research.runId)) return;
            setSettled(research.runId, { status, jobId: research.jobId, phase: "loading" });
            fetchResearchAnswers(0);
        },
        [fetchResearchAnswers]
    );

    const showResearchAnswer = useCallback(
        (research) => {
            const value = settledRef.current.get(research.runId);
            if (!value) return;
            setSettled(research.runId, { ...value, phase: "loading" });
            fetchResearchAnswers(0);
        },
        [fetchResearchAnswers]
    );

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
    // Research whose answer is already in the thread shows nothing extra.
    const answered = answeredResearch(messages);
    const researchStatusFor = (m) => {
        const r = m.research;
        if (!r?.runId || !isActiveRun(r.status) || isAnswered(r, answered)) return null;
        return (
            <ResearchStatus
                research={r}
                settled={settledRuns.get(r.runId) || null}
                onFinished={onResearchFinished}
                onShowAnswer={() => showResearchAnswer(r)}
            />
        );
    };

    return (
        <div className="page page--chat">
            <TopBar
                title="Wizz"
                subtitle="Knowledge"
                leading={
                    <ActionIcon unstyled
                        type="button"
                        className="icon-btn"
                        onClick={() => setHistoryOpen(true)}
                        aria-label="Conversation history"
                    >
                        <Icon name="history" size={22} />
                    </ActionIcon>
                }
            >
                <BranchPicker branches={branches} value={branch} onChange={setBranch} disabled={sending} />
                <ActionIcon unstyled type="button" className="icon-btn" onClick={newChat} aria-label="New chat">
                    <Icon name="plus" size={22} />
                </ActionIcon>
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
                                        <Button unstyled
                                            type="button"
                                            className="btn btn--secondary btn--sm"
                                            onClick={() => loadConversation(routeId)}
                                        >
                                            Retry
                                        </Button>
                                    ) : null}
                                    <Button unstyled type="button" className="btn btn--ghost btn--sm" onClick={newChat}>
                                        New chat
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {empty ? (
                        <StarterQuestions
                            name={name}
                            onPick={send}
                            disabled={sending}
                            research={canUseResearch(wizz)}
                            tasks={canUseTasks(wizz) ? taskRoleOf(wizz) : null}
                        />
                    ) : null}

                    {messages.map((m) =>
                        m.role === "user" ? (
                            <UserMessage key={m.id} message={m} onRetry={retry} retryDisabled={sending} />
                        ) : (
                            <AssistantMessage key={m.id} message={m} branches={branches}>
                                {researchStatusFor(m)}
                            </AssistantMessage>
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
