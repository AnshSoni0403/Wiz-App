/**
 * App configuration.
 *
 * The API is always same-origin: in production the API server serves this app at /wizz-app/,
 * and in development Vite proxies /api to the Admin's dev API (see vite.config.js).
 * Keeping it same-origin is what lets the existing cookie session work without CORS.
 */
const config = {
    apiBaseUrl: "",
    routerBasename: import.meta.env.BASE_URL.replace(/\/+$/, "") || "/",
    requestTimeoutMs: 30000,
    chatTimeoutMs: 120000,
    maxMessageLength: 4000,
    channel: "pwa",
};

export default config;
