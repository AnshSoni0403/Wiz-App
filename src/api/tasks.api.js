/**
 * Task Agent API (shared with the Admin; see marwizvision-v2-server/docs/task-agent-api.md).
 * The server decides who may see or change what; these calls never send an actor or organisation.
 */
import api, { unwrap } from "./client";
import { ENDPOINTS } from "./endpoints";
import config from "../config";

const T = ENDPOINTS.TASKS;

/** Drops empty filter values so the query string stays short. */
const clean = (params = {}) =>
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const getTaskAccess = async ({ signal } = {}) => unwrap(await api.get(T.ACCESS, { signal }));

/** `{ items, total, page, perPage }` */
export const listTasks = async (params = {}, { signal } = {}) => unwrap(await api.get(T.LIST, { params: clean(params), signal }));

export const getTaskSummary = async (params = {}, { signal } = {}) =>
    unwrap(await api.get(T.SUMMARY, { params: clean(params), signal }));

export const getWorkload = async (params = {}, { signal } = {}) =>
    unwrap(await api.get(T.WORKLOAD, { params: clean(params), signal }));

export const getDirectory = async (q = "", { signal } = {}) =>
    unwrap(await api.get(T.DIRECTORY, { params: clean({ q }), signal }));

export const listTeams = async ({ signal } = {}) => unwrap(await api.get(T.TEAMS, { signal }));

export const getTask = async (taskId, { signal } = {}) => unwrap(await api.get(T.ONE(taskId), { signal }));

export const createTask = async (body) => unwrap(await api.post(T.LIST, body));

export const updateTask = async (taskId, body) => unwrap(await api.put(T.ONE(taskId), body));

export const setTaskStatus = async (taskId, status, reason) =>
    unwrap(await api.put(T.STATUS(taskId), reason ? { status, reason } : { status }));

export const reviewTask = async (taskId, decision, note) =>
    unwrap(await api.post(T.REVIEW(taskId), note ? { decision, note } : { decision }));

export const addComment = async (taskId, message, idempotencyKey) =>
    unwrap(await api.post(T.COMMENTS(taskId), { message, idempotencyKey }));

export const setFollowUp = async (taskId, needsFollowUp, note) =>
    unwrap(await api.put(T.FOLLOW_UP(taskId), note ? { needsFollowUp, note } : { needsFollowUp }));

export const addChecklistItem = async (taskId, text) => unwrap(await api.post(T.CHECKLIST(taskId), { text }));

export const updateChecklistItem = async (taskId, itemId, patch) =>
    unwrap(await api.patch(T.CHECKLIST_ITEM(taskId, itemId), patch));

export const deleteChecklistItem = async (taskId, itemId) => unwrap(await api.delete(T.CHECKLIST_ITEM(taskId, itemId)));

/** File evidence as base64 JSON (≤ 3 MB decoded), or a link `{ url, name }`. */
export const addAttachment = async (taskId, body) =>
    unwrap(await api.post(T.ATTACHMENTS(taskId), body, { timeout: config.chatTimeoutMs }));

export const deleteAttachment = async (taskId, attId) => unwrap(await api.delete(T.ATTACHMENT(taskId, attId)));

export const setWatching = async (taskId, watching) => unwrap(await api.post(T.WATCH(taskId), { watching }));

// ---- chat confirmations ----
export const confirmTaskAction = async (actionId) => unwrap(await api.post(ENDPOINTS.WIZZ.TASK_ACTION_CONFIRM(actionId), {}));

export const cancelTaskAction = async (actionId) => unwrap(await api.post(ENDPOINTS.WIZZ.TASK_ACTION_CANCEL(actionId), {}));

export const switchTaskActionMode = async (actionId, teamMode) =>
    unwrap(await api.patch(ENDPOINTS.WIZZ.TASK_ACTION(actionId), { teamMode }));
