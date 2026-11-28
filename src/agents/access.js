/**
 * Who may use which agent. Kept apart from registry.js so screens (e.g. the chat's starter
 * prompts) can ask without importing the registry, which imports every page.
 * The server enforces the same rules; these only decide what the app offers.
 */
const STAFF_ROLES = ["owner", "branch_head", "editor", "staff"];

const isStaff = (wizz) => Boolean(wizz && (wizz.isOwner || STAFF_ROLES.includes(wizz.member?.role)));

/** Proposals: staff roles, not partners. */
export const canUseProposals = isStaff;

/**
 * Web research from chat (the server decides when a question needs it): guarded by
 * requireWizzRole("owner","branch_head","editor","staff") on the server. Only decides which
 * example questions the chat offers.
 */
export const canUseResearch = isStaff;

/**
 * Tasks: the server says so in /wizz/me (`tasks.enabled`); older servers without that field fall
 * back to the staff-role check. Partners never get tasks.
 */
export const canUseTasks = (wizz) => {
    if (!wizz) return false;
    if (wizz.member?.role === "partner") return false;
    if (wizz.tasks && typeof wizz.tasks.enabled === "boolean") return wizz.tasks.enabled;
    return isStaff(wizz);
};

/** Task role from /wizz/me when present ("owner" | "branch_head" | "team_lead" | "staff"). */
export const taskRoleOf = (wizz) => wizz?.tasks?.role || (wizz?.isOwner ? "owner" : "staff");
