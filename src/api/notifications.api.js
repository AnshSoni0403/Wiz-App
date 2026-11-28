/**
 * Notification inbox (persistent, read state per user) and optional browser push subscriptions.
 */
import api, { unwrap } from "./client";
import { ENDPOINTS } from "./endpoints";

const N = ENDPOINTS.NOTIFICATIONS;

/** `{ items, total, unread }` */
export const listNotifications = async ({ unread = false, page = 1, perPage = 20 } = {}, { signal } = {}) =>
    unwrap(await api.get(N.LIST, { params: { ...(unread ? { unread: 1 } : {}), page, per_page: perPage }, signal }));

/** `{ unread }` */
export const getUnreadCount = async ({ signal } = {}) => unwrap(await api.get(N.UNREAD_COUNT, { signal }));

export const markRead = async (id) => unwrap(await api.post(N.READ(id), {}));

export const markAllRead = async () => unwrap(await api.post(N.READ_ALL, {}));

/** `{ enabled, publicKey }` */
export const getPushConfig = async () => unwrap(await api.get(N.PUSH_CONFIG));

export const subscribePush = async (subscription) => unwrap(await api.post(N.PUSH_SUBSCRIBE, { subscription }));

export const unsubscribePush = async (endpoint, { skipAuthRedirect = false } = {}) =>
    unwrap(await api.post(N.PUSH_UNSUBSCRIBE, { endpoint }, { skipAuthRedirect }));
