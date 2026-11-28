/* eslint-disable react-refresh/only-export-components */
/**
 * Session + Wizz membership state.
 *
 * status:
 *  - "loading"    checking the cookie session
 *  - "anonymous"  no session -> login screen
 *  - "no-access"  signed in, but /wizz/me answered 403 WIZZ_NO_ACCESS
 *  - "error"      the server could not be reached (retry)
 *  - "ready"      signed in Wizz member; `wizz` holds the /wizz/me payload
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentUser, loginCompany, logoutSession } from "../api/auth.api";
import { getWizzMe } from "../api/wizz.api";
import { UNAUTHORIZED_EVENT } from "../api/client";
import { ApiError, toApiError } from "../utils/errors";
import { clearPrefs, readPref, writePref } from "../utils/storage";
import { disablePushOnLogout } from "../pwa/push";

const AuthContext = createContext(null);

const SOFT_LOGOUT_KEY = "softLogout";

const ANONYMOUS = { status: "anonymous", user: null, wizz: null, error: null };

export const AuthProvider = ({ children }) => {
    const [state, setState] = useState({ status: "loading", user: null, wizz: null, error: null });
    const runRef = useRef(0);

    /** Loads /auth/me then /wizz/me. `silent` keeps the current screen while loading. */
    const establish = useCallback(async ({ silent = false } = {}) => {
        const run = ++runRef.current;
        if (readPref(SOFT_LOGOUT_KEY, false)) {
            setState(ANONYMOUS);
            return ANONYMOUS.status;
        }
        if (!silent) setState((s) => ({ ...s, status: "loading", error: null }));

        let next;
        let user = null;
        try {
            const res = await getCurrentUser();
            if (!res.data?.isOk || !res.data?.data) throw new ApiError({ kind: "http", status: 401 });
            user = res.data.data;
        } catch (err) {
            const e = toApiError(err);
            next =
                e.kind === "http" && [401, 403, 404].includes(e.status)
                    ? ANONYMOUS
                    : { status: "error", user: null, wizz: null, error: e };
        }

        if (!next) {
            try {
                const wizz = await getWizzMe();
                next = { status: "ready", user, wizz, error: null };
            } catch (err) {
                const e = toApiError(err);
                if (e.status === 401) next = ANONYMOUS;
                else if (e.status === 403) next = { status: "no-access", user, wizz: null, error: e };
                else next = { status: "error", user, wizz: null, error: e };
            }
        }

        if (run === runRef.current) setState(next);
        return next.status;
    }, []);

    useEffect(() => {
        establish();
    }, [establish]);

    // Any 401 from a normal API call means the session expired: back to login.
    useEffect(() => {
        const onUnauthorized = () => {
            runRef.current += 1;
            setState(ANONYMOUS);
        };
        window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
        return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    }, []);

    const login = useCallback(
        async ({ email, password }) => {
            const res = await loginCompany({ email: email.trim(), password });
            if (!res.data?.isOk) {
                throw new ApiError({
                    kind: "http",
                    status: res.status,
                    code: res.data?.code,
                    message: res.data?.message || "Invalid credentials",
                });
            }
            writePref(SOFT_LOGOUT_KEY, null);
            const status = await establish({ silent: true });
            if (status === "anonymous") {
                throw new ApiError({
                    kind: "http",
                    status: 401,
                    message: "Signed in, but the session could not be kept. Please allow cookies for this site and try again.",
                });
            }
        },
        [establish]
    );

    const logout = useCallback(async () => {
        let softLogout = false;
        // This device stops receiving task pushes for this account (needs the session, so first).
        await disablePushOnLogout();
        try {
            await logoutSession();
        } catch (err) {
            // POST /auth/logout ends Admin, Employee and Associate sessions (authMiddleware admits
            // Associates on ADMIN/EMPLOYEE routes). If the server can't be reached or refuses anyway,
            // keep the app signed out on this device until the next login. 401 = session already gone.
            softLogout = toApiError(err).status !== 401;
        }
        clearPrefs(["installDismissedAt"]);
        if (softLogout) writePref(SOFT_LOGOUT_KEY, true);
        runRef.current += 1;
        setState(ANONYMOUS);
    }, []);

    /** Re-reads /wizz/me (e.g. after linking Telegram) without a loading screen. */
    const refreshWizz = useCallback(async () => {
        try {
            const wizz = await getWizzMe();
            setState((s) => ({ ...s, status: "ready", wizz, error: null }));
            return wizz;
        } catch (err) {
            const e = toApiError(err);
            if (e.status === 401) setState(ANONYMOUS);
            else if (e.status === 403) setState((s) => ({ ...s, status: "no-access", wizz: null, error: e }));
            throw e;
        }
    }, []);

    const value = useMemo(
        () => ({ ...state, login, logout, retry: establish, refreshWizz }),
        [state, login, logout, establish, refreshWizz]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
};

export default AuthContext;
