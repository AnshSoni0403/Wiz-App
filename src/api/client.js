/**
 * Shared axios instance. Cookie session auth (express-session), so every request sends
 * credentials. A 401 anywhere (except the auth calls themselves) signs the app out.
 */
import axios from "axios";
import config from "../config";
import { ApiError } from "../utils/errors";

export const UNAUTHORIZED_EVENT = "wizz:unauthorized";

const api = axios.create({
    baseURL: config.apiBaseUrl,
    timeout: config.requestTimeoutMs,
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401 && !error.config?.skipAuthRedirect) {
            window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
        }
        return Promise.reject(error);
    }
);

/**
 * Returns `data` from the server envelope `{ isOk, status, data, message }`,
 * throwing an ApiError when the envelope reports a failure.
 */
export const unwrap = (response) => {
    const body = response?.data;
    if (body && body.isOk === false) {
        throw new ApiError({
            kind: "http",
            status: body.status || response.status,
            code: body.code,
            message: body.message,
            errors: body.errors,
        });
    }
    return body?.data;
};

export default api;
