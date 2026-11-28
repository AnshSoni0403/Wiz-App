/**
 * Optional browser push for task notifications. Off until the member turns it on in Profile;
 * the browser then asks for permission. The in-app inbox works without any of this.
 */
import { subscribePush, unsubscribePush } from "../api/notifications.api";

export const isPushSupported = () =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    window.isSecureContext;

export const pushPermission = () => (typeof Notification !== "undefined" ? Notification.permission : "denied");

const urlBase64ToUint8Array = (base64) => {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** The active service worker registration, or null if none becomes ready in time (e.g. dev server). */
const readyRegistration = (ms = 8000) =>
    Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => window.setTimeout(() => resolve(null), ms))]);

export const currentSubscription = async () => {
    if (!isPushSupported()) return null;
    const reg = await readyRegistration(3000);
    return reg ? reg.pushManager.getSubscription() : null;
};

/**
 * Asks for permission (must run from a tap), subscribes and registers the subscription with the server.
 * @returns {"enabled"|"denied"|"unavailable"}
 */
export const enablePush = async (publicKey) => {
    if (!isPushSupported() || !publicKey) return "unavailable";
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const reg = await readyRegistration();
    if (!reg) return "unavailable";
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    }
    try {
        await subscribePush(sub.toJSON());
    } catch (err) {
        // The server did not keep it: do not leave a dangling browser subscription.
        await sub.unsubscribe().catch(() => {});
        throw err;
    }
    return "enabled";
};

/** Removes this device's subscription from the server and the browser. */
export const disablePush = async ({ onLogout = false } = {}) => {
    const sub = await currentSubscription().catch(() => null);
    if (!sub) return;
    try {
        await unsubscribePush(sub.endpoint, { skipAuthRedirect: onLogout });
    } catch {
        // still drop it locally; the server also discards endpoints the push service rejects
    }
    await sub.unsubscribe().catch(() => {});
};

/** Logout: stop pushes for this device before the session ends, but never hold logout up for long. */
export const disablePushOnLogout = () =>
    Promise.race([disablePush({ onLogout: true }).catch(() => {}), new Promise((resolve) => window.setTimeout(resolve, 3000))]);
