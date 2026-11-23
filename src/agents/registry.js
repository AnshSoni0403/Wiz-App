/**
 * Agent registry - every Wizz agent is a tab in the bottom navigation and a route.
 *
 * To add an agent later (Tasks, CRM, ...):
 *   1. build its page under src/pages/<agent>/,
 *   2. set `Component` and `enabled: true` below (or decide per user with `isAvailable(wizz)`,
 *      e.g. from a future field on GET /wizz/me),
 *   3. add its server endpoints to src/api/.
 * Disabled agents are hidden from the navigation and have no route.
 */
import KnowledgeChatPage from "../pages/knowledge/KnowledgeChatPage";
import ProposalsPage from "../pages/proposals/ProposalsPage";

export const AGENTS = [
    {
        key: "knowledge",
        label: "Knowledge",
        icon: "book",
        path: "/knowledge",
        routePath: "knowledge/:conversationId?",
        enabled: true,
        Component: KnowledgeChatPage,
    },
    {
        key: "proposals",
        label: "Proposals",
        icon: "proposal",
        path: "/proposals",
        routePath: "proposals/:draftId?",
        enabled: true,
        isAvailable: (wizz) => Boolean(wizz && (wizz.isOwner || ["owner", "branch_head", "editor", "staff"].includes(wizz.member?.role))),
        Component: ProposalsPage,
    },
    {
        key: "tasks",
        label: "Tasks",
        icon: "tasks",
        path: "/tasks",
        routePath: "tasks/*",
        enabled: false,
        Component: null,
    },
    {
        key: "crm",
        label: "CRM",
        icon: "users",
        path: "/crm",
        routePath: "crm/*",
        enabled: false,
        Component: null,
    },
];

/** Agents this member can use. */
export const availableAgents = (wizz) =>
    AGENTS.filter((agent) => agent.enabled && agent.Component && (!agent.isAvailable || agent.isAvailable(wizz)));

export const DEFAULT_AGENT_PATH = AGENTS.find((a) => a.enabled && a.Component)?.path || "/profile";
