/**
 * Normalises axios / envelope failures into one shape the UI can reason about.
 */
import axios from "axios";

export const NO_ACCESS_MESSAGE =
    "Your account doesn't have Wizz access yet — ask your admin to add you in Admin → Wizz → Members & Access";

export const AI_NOT_CONFIGURED_MESSAGE = "Wizz's AI isn't switched on yet. Please ask your admin to finish the setup.";

export class ApiError extends Error {
    constructor({ kind = "http", status = 0, code = "", message = "" } = {}) {
        super(message || "Request failed");
        this.name = "ApiError";
        this.kind = kind; // "http" | "network" | "timeout" | "cancelled"
        this.status = status;
        this.code = code || "";
        this.serverMessage = message || "";
    }
}

export const toApiError = (error) => {
    if (error instanceof ApiError) return error;
    if (axios.isCancel(error) || error?.code === "ERR_CANCELED" || error?.name === "AbortError") {
        return new ApiError({ kind: "cancelled", message: "Cancelled" });
    }
    if (error?.response) {
        const body = error.response.data && typeof error.response.data === "object" ? error.response.data : {};
        return new ApiError({
            kind: "http",
            status: error.response.status,
            code: body.code,
            message: body.message,
        });
    }
    if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
        return new ApiError({ kind: "timeout", message: "Timed out" });
    }
    return new ApiError({ kind: "network", message: error?.message || "Network error" });
};

/** A sentence that is safe and helpful to show to the user. */
export const friendlyMessage = (error) => {
    const e = toApiError(error);
    if (e.kind === "cancelled") return "Cancelled.";
    if (e.kind === "timeout") return "Wizz is taking too long to answer. Please try again.";
    if (e.kind === "network") {
        return typeof navigator !== "undefined" && navigator.onLine === false
            ? "You're offline. Reconnect and try again."
            : "Couldn't reach Wizz. Check your connection and try again.";
    }
    switch (e.code) {
        case "WIZZ_NO_ACCESS":
            return NO_ACCESS_MESSAGE;
        case "AI_NOT_CONFIGURED":
            return AI_NOT_CONFIGURED_MESSAGE;
        case "WIZZ_FORBIDDEN_BRANCH":
            return "You don't have access to that branch. Pick another branch and try again.";
        case "VALIDATION":
            return e.serverMessage || "Please check your message and try again.";
        default:
            break;
    }
    if (e.status === 401) return "Your session has ended. Please sign in again.";
    if (e.status === 404) return e.serverMessage || "That item no longer exists.";
    if (e.status === 429) return e.serverMessage || "Too many requests. Please wait a moment and try again.";
    if (e.status >= 500) return "Something went wrong on the server. Please try again.";
    return e.serverMessage || "Something went wrong. Please try again.";
};

/** Whether a retry button makes sense for this failure. */
export const isRetryable = (error) => {
    const e = toApiError(error);
    if (e.kind === "network" || e.kind === "timeout") return true;
    if (e.code === "WIZZ_NO_ACCESS" || e.code === "VALIDATION" || e.code === "WIZZ_FORBIDDEN_BRANCH") return false;
    return e.status === 429 || e.status >= 500;
};
