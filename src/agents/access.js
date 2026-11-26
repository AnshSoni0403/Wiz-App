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
