export const ROLE_LABELS = {
    owner: "Owner",
    branch_head: "Branch head",
    editor: "Editor",
    staff: "Staff",
    partner: "Partner",
};

export const AUDIENCE_LABELS = {
    client: "Client-safe content",
    partner: "Partner-safe content",
    internal: "Internal content",
    restricted: "Restricted content (incl. costs and margins)",
};

const FALLBACK_BRANCH_NAMES = { GLOBAL: "Global", IN: "India", UK: "United Kingdom", KE: "Kenya" };

/** Branch display name, using the list from /wizz/me when available. */
export const branchName = (code, branches = []) =>
    branches.find((b) => b.code === code)?.name || FALLBACK_BRANCH_NAMES[code] || code || "";

export const initials = (name = "") =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "?";

export const firstName = (name = "") => name.trim().split(/\s+/)[0] || "";

/** "Just now", "5 min ago", "Yesterday", "12 Nov". */
export const relativeTime = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    const diff = Date.now() - date.getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const countdown = (msLeft) => {
    const total = Math.max(0, Math.ceil(msLeft / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
};

let counter = 0;
export const localId = () => {
    counter += 1;
    return `local-${Date.now().toString(36)}-${counter}`;
};

/** Copies text, falling back to a hidden textarea where the Clipboard API is unavailable. */
export const copyText = async (text) => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through
    }
    try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(area);
        return ok;
    } catch {
        return false;
    }
};
