/**
 * API endpoint constants (same paths the Admin uses for auth; Wizz paths per the shared contract).
 */
const V1 = "/api/v1";

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
        CONVERSATION: (id) => `${V1}/wizz/conversations/${encodeURIComponent(id)}`,
        CHAT: `${V1}/wizz/chat`,
    },
};

export default ENDPOINTS;
