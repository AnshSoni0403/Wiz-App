/**
 * localStorage helpers for small per-device conveniences (branch choice, dismissed hints).
 * Never used for answers or anything private. Every access is guarded because storage can be
 * unavailable (private mode, blocked site data).
 */
const PREFIX = "wizz.";

export const readPref = (key, fallback = null) => {
    try {
        const raw = window.localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
};

export const writePref = (key, value) => {
    try {
        if (value === undefined || value === null) window.localStorage.removeItem(PREFIX + key);
        else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
        // ignore
    }
};

/** Removes every Wizz preference (used on logout). */
export const clearPrefs = (keep = []) => {
    try {
        const remove = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(PREFIX) && !keep.includes(key.slice(PREFIX.length))) remove.push(key);
        }
        remove.forEach((key) => window.localStorage.removeItem(key));
    } catch {
        // ignore
    }
};
