import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Brand values come from the Admin's theme (marwizvision-v2-admin/src/constants/roleTheme.js, GOLD_THEME).
const BRAND_PRIMARY = "#8F6B2F";
const BRAND_CANVAS = "#F6F3ED";

const appConfig = {
    // The server serves the built app at /wizz-app/ on the same origin as the API.
    // (Not /wizz/: the Admin uses /wizz/knowledge etc., and the service worker scope must not cover them.)
    base: "/wizz-app/",
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
        react(),
        VitePWA({
            registerType: "prompt",
            injectRegister: false, // registered from src/components/UpdatePrompt.jsx
            // public/ icons are already matched by workbox.globPatterns; avoid duplicate precache entries.
            includeAssets: [],
            includeManifestIcons: false,
            manifest: {
                id: "/wizz-app/",
                name: "Wizz",
                short_name: "Wizz",
                description: "Marwiz Vision's AI assistant for staff",
                start_url: "/wizz-app/",
                scope: "/wizz-app/",
                display: "standalone",
                orientation: "portrait",
                background_color: BRAND_CANVAS,
                theme_color: BRAND_PRIMARY,
                icons: [
                    { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
                    { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
                    { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
                ],
            },
            workbox: {
                // App shell only. Nothing under /api/ is ever precached or runtime-cached.
                globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest,woff2}"],
                navigateFallback: "/wizz-app/index.html",
                navigateFallbackAllowlist: [/^\/wizz-app(\/|$)/],
                navigateFallbackDenylist: [/^\/api\//],
                cleanupOutdatedCaches: true,
                // Optional task-notification push ("push" / "notificationclick" handlers, public/push-sw.js).
                importScripts: ["push-sw.js"],
                runtimeCaching: [
                    {
                        // Private answers, sessions and signed file links must never be stored offline.
                        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
                        handler: "NetworkOnly",
                    },
                ],
            },
        }),
    ],
    server: {
        port: 7003,
        strictPort: true,
    },
    preview: {
        port: 7003,
    },
    build: {
        outDir: "dist",
        sourcemap: false,
    },
};

export default defineConfig(({ command, mode }) => {
    // A machine-wide NODE_ENV=development would otherwise make `vite build` bundle React's
    // development build. Production builds always use production React.
    if (command === "build" && mode === "production") process.env.NODE_ENV = "production";
    if (command !== "serve") return appConfig;
    const upstream = loadEnv(mode, process.cwd(), "WIZZ_").WIZZ_BACKEND_ORIGIN;
    if (!upstream) return appConfig;
    const url = new URL(upstream);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("WIZZ_BACKEND_ORIGIN must be a deployed HTTPS origin.");
    }
    return {
        ...appConfig,
        server: {
            ...appConfig.server,
            proxy: {
                "/api": {
                    target: url.origin,
                    changeOrigin: true,
                    configure: (proxy) => {
                        proxy.on("proxyReq", (proxyReq, req) => {
                            const origin = req.headers.origin;
                            if (origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`) {
                                proxyReq.setHeader("origin", url.origin);
                            }
                        });
                    },
                },
            },
        },
    };
});
