/*
 * Task notification push handlers, loaded into the generated service worker with importScripts
 * (vite.config.js → workbox.importScripts). Only shows what the server sends; caches nothing.
 * Payload (JSON): { title, body, url?, taskId?, tag? }.
 */
/* eslint-disable no-restricted-globals */
const APP_BASE = new URL("./", self.registration.scope).pathname; // "/wizz-app/"

const targetUrl = (data) => {
    if (data && typeof data.url === "string" && data.url.startsWith(APP_BASE)) return data.url;
    if (data && typeof data.taskId === "string" && /^[a-f\d]{24}$/i.test(data.taskId)) return `${APP_BASE}tasks/${data.taskId}`;
    return `${APP_BASE}tasks`;
};

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : "" };
    }
    const title = typeof data.title === "string" && data.title ? data.title.slice(0, 120) : "Wizz";
    event.waitUntil(
        self.registration.showNotification(title, {
            body: typeof data.body === "string" ? data.body.slice(0, 300) : "",
            icon: `${APP_BASE}pwa-192.png`,
            badge: `${APP_BASE}pwa-192.png`,
            tag: typeof data.tag === "string" ? data.tag : undefined,
            data: { url: targetUrl(data) },
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || `${APP_BASE}tasks`;
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                if (new URL(client.url).pathname.startsWith(APP_BASE) && "focus" in client) {
                    if ("navigate" in client) client.navigate(url).catch(() => {});
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});
