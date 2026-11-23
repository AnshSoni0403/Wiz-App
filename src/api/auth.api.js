/**
 * Auth calls - the same company login the Admin uses (marwizvision-v2-admin/src/api/auth.api.jsx).
 */
import api from "./client";
import { ENDPOINTS } from "./endpoints";

/** Company login. 4xx responses resolve so the caller can show the server's message. */
export const loginCompany = ({ email, password }) =>
    api.post(
        ENDPOINTS.AUTH.COMPANY_LOGIN,
        { email, password },
        {
            skipAuthRedirect: true,
            validateStatus: (status) => (status >= 200 && status < 300) || (status >= 400 && status < 500),
        }
    );

/** Current session user: `{ _id, employeeName, emailOffice, role, isSuperAdmin, ... }`. */
export const getCurrentUser = () => api.get(ENDPOINTS.AUTH.ME, { skipAuthRedirect: true });

/** Destroys the server session (shared with the Admin on the same origin). */
export const logoutSession = () => api.post(ENDPOINTS.AUTH.LOGOUT, null, { skipAuthRedirect: true });
