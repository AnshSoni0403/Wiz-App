/**
 * Wizz self-service + chat API (see the shared contract, "HTTP API").
 */
import api, { unwrap } from "./client";
import { ENDPOINTS } from "./endpoints";
import config from "../config";

/** `{ member, branches, canManage, isOwner, aiConfigured, telegramBotUsername }` */
export const getWizzMe = async () => unwrap(await api.get(ENDPOINTS.WIZZ.ME, { skipAuthRedirect: true }));

/** `{ code, expiresAt, botUsername }` */
export const createTelegramCode = async () => unwrap(await api.post(ENDPOINTS.WIZZ.TELEGRAM_CODE));

export const unlinkTelegram = async () => unwrap(await api.delete(ENDPOINTS.WIZZ.TELEGRAM));

/** `[{ id, title, updatedAt }]` newest first. */
export const listConversations = async ({ signal } = {}) =>
    unwrap(await api.get(ENDPOINTS.WIZZ.CONVERSATIONS, { params: { channel: config.channel }, signal })) || [];

/** `{ id, title, channel, messages }` */
export const getConversation = async (id, { signal } = {}) =>
    unwrap(await api.get(ENDPOINTS.WIZZ.CONVERSATION(id), { signal }));

export const deleteConversation = async (id) => unwrap(await api.delete(ENDPOINTS.WIZZ.CONVERSATION(id)));

/**
 * Ask the Knowledge Base Agent.
 * @returns `{ conversationId, reply: { role, text, citations, media, at }, gapLogged }`
 */
export const sendChat = async ({ conversationId, message, branch }, { signal } = {}) => {
    const body = { message, channel: config.channel };
    if (conversationId) body.conversationId = conversationId;
    if (branch) body.branch = branch;
    return unwrap(await api.post(ENDPOINTS.WIZZ.CHAT, body, { timeout: config.chatTimeoutMs, signal }));
};
