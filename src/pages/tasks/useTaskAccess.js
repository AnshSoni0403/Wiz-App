import { useEffect, useState } from "react";
import { getTaskAccess } from "../../api/tasks.api";
import { useAuth } from "../../context/AuthContext";
import { toApiError } from "../../utils/errors";

let cached = null; // { key, access } — one fetch per signed-in member per page load

/**
 * The caller's task role. Uses `tasks` from /wizz/me when the server sends it, otherwise
 * GET /tasks/access once. Returns { access, loading, error }.
 */
const useTaskAccess = () => {
    const { wizz } = useAuth();
    const key = wizz?.member?.id || wizz?.member?.email || "me";
    const fromMe = wizz?.tasks && typeof wizz.tasks === "object" && wizz.tasks.role ? wizz.tasks : null;
    const [state, setState] = useState(() => ({
        access: fromMe || (cached?.key === key ? cached.access : null),
        loading: !fromMe && cached?.key !== key,
        error: null,
    }));

    useEffect(() => {
        if (fromMe) {
            setState({ access: fromMe, loading: false, error: null });
            return undefined;
        }
        if (cached?.key === key) {
            setState({ access: cached.access, loading: false, error: null });
            return undefined;
        }
        const controller = new AbortController();
        getTaskAccess({ signal: controller.signal })
            .then((access) => {
                cached = { key, access };
                setState({ access, loading: false, error: null });
            })
            .catch((err) => {
                if (toApiError(err).kind === "cancelled") return;
                // Fall back to the plainest view; the server still enforces every rule.
                setState({ access: { enabled: true, role: wizz?.isOwner ? "owner" : "staff" }, loading: false, error: err });
            });
        return () => controller.abort();
    }, [key, fromMe, wizz?.isOwner]);

    return state;
};

export default useTaskAccess;
