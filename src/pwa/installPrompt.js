/**
 * Captures `beforeinstallprompt` as early as possible (this module is imported from main.jsx,
 * before React renders) and exposes it through a hook.
 */
import { useCallback, useSyncExternalStore } from "react";

let deferredPrompt = null;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredPrompt = event;
        emit();
    });
    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        emit();
    });
}

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const isStandalone = () =>
    typeof window !== "undefined" &&
    ((typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
        window.navigator.standalone === true);

export const isIos = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

export const useInstallPrompt = () => {
    const canInstall = useSyncExternalStore(
        subscribe,
        () => deferredPrompt !== null,
        () => false
    );

    const promptInstall = useCallback(async () => {
        const event = deferredPrompt;
        if (!event) return "unavailable";
        deferredPrompt = null;
        emit();
        await event.prompt();
        try {
            const choice = await event.userChoice;
            return choice?.outcome || "dismissed";
        } catch {
            return "dismissed";
        }
    }, []);

    return {
        canInstall,
        promptInstall,
        standalone: isStandalone(),
        ios: isIos(),
    };
};
