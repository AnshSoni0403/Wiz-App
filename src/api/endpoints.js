/**
 * API endpoint constants (same paths the Admin uses for auth; Wizz paths per the shared contract).
 */
const V1 = "/api/v1";
const id = (value) => encodeURIComponent(value);

export const ENDPOINTS = {
    AUTH: {
        COMPANY_LOGIN: `${V1}/auth/company/login`,
        ME: `${V1}/auth/me`,
        LOGOUT: `${V1}/auth/logout`,
    },
    WIZZ: {
        ME: `${V1}/wizz/me`,
        TELEGRAM_CODE: `${V1}/wizz/me/telegram-code`,
        TELEGRAM: `${V1}/wizz/me/telegram`,
        CONVERSATIONS: `${V1}/wizz/conversations`,
        CONVERSATION: (cid) => `${V1}/wizz/conversations/${id(cid)}`,
        CHAT: `${V1}/wizz/chat`,
        TASK_ACTION: (aid) => `${V1}/wizz/tasks/actions/${id(aid)}`,
        TASK_ACTION_CONFIRM: (aid) => `${V1}/wizz/tasks/actions/${id(aid)}/confirm`,
        TASK_ACTION_CANCEL: (aid) => `${V1}/wizz/tasks/actions/${id(aid)}/cancel`,
    },
    TASKS: {
        LIST: `${V1}/tasks`,
        ACCESS: `${V1}/tasks/access`,
        DIRECTORY: `${V1}/tasks/directory`,
        SUMMARY: `${V1}/tasks/summary`,
        WORKLOAD: `${V1}/tasks/workload`,
        TEAMS: `${V1}/tasks/teams`,
        ONE: (tid) => `${V1}/tasks/${id(tid)}`,
        STATUS: (tid) => `${V1}/tasks/${id(tid)}/status`,
        REVIEW: (tid) => `${V1}/tasks/${id(tid)}/review`,
        COMMENTS: (tid) => `${V1}/tasks/${id(tid)}/comments`,
        FOLLOW_UP: (tid) => `${V1}/tasks/${id(tid)}/follow-up`,
        CHECKLIST: (tid) => `${V1}/tasks/${id(tid)}/checklist`,
        CHECKLIST_ITEM: (tid, itemId) => `${V1}/tasks/${id(tid)}/checklist/${id(itemId)}`,
        ATTACHMENTS: (tid) => `${V1}/tasks/${id(tid)}/attachments`,
        ATTACHMENT: (tid, attId) => `${V1}/tasks/${id(tid)}/attachments/${id(attId)}`,
        WATCH: (tid) => `${V1}/tasks/${id(tid)}/watch`,
    },
    NOTIFICATIONS: {
        LIST: `${V1}/notifications`,
        UNREAD_COUNT: `${V1}/notifications/unread-count`,
        READ: (nid) => `${V1}/notifications/${id(nid)}/read`,
        READ_ALL: `${V1}/notifications/read-all`,
        PUSH_CONFIG: `${V1}/notifications/push/config`,
        PUSH_SUBSCRIBE: `${V1}/notifications/push/subscribe`,
        PUSH_UNSUBSCRIBE: `${V1}/notifications/push/unsubscribe`,
    },
};

export default ENDPOINTS;
