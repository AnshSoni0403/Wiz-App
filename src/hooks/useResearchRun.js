import { useEffect, useState } from "react";
import { getResearchRun } from "../api/research.api";
import { toApiError } from "../utils/errors";
import { isActiveRun } from "../utils/research";

export const RUN_POLL_MS = 4000;

/** Client errors that won't fix themselves (403, 404, ...): polling stops. 408 / 429 are retried. */
const isFinalError = (e) => e?.kind === "http" && e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status);

/**
 * Follows a research run started from chat: GET /wizz/research/runs/:id right away (the status
 * saved on an old message may be stale) and then every 4 s while it is queued, researching or
 * drafting. Stops once it is ready / failed / cancelled or on a final client error, and pauses
 * while the page is hidden. Pass `status` (what the caller already knows) to skip polling for a
 * run that has already finished.
 *
 * Returns `{ run, error, stopped }`; `stopped` is true after a final error.
 */
export default function useResearchRun(runId, status = "") {
    const [run, setRun] = useState(() => (runId ? { id: runId, status } : null));
    const [error, setError] = useState(null);
    const current = run?.status || status;
    const stopped = isFinalError(error);
    const following = Boolean(runId) && !stopped && (!current || isActiveRun(current));

    useEffect(() => {
        if (!following) return undefined;
        let cancelled = false;
        let timer = null;
        let controller = null;

        const tick = async () => {
            if (document.visibilityState === "hidden") {
                timer = window.setTimeout(tick, RUN_POLL_MS);
                return;
            }
            controller = new AbortController();
            try {
                const next = await getResearchRun(runId, controller.signal);
                if (cancelled) return;
                setError(null);
                if (next && typeof next === "object") setRun((previous) => ({ ...(previous || {}), ...next }));
                // A finished run flips `following`, which tears this effect down.
                if (next?.status && !isActiveRun(next.status)) return;
            } catch (err) {
                if (cancelled) return;
                const e = toApiError(err);
                if (e.kind === "cancelled") return;
                setError(e);
                if (isFinalError(e)) return;
            }
            timer = window.setTimeout(tick, RUN_POLL_MS);
        };

        timer = window.setTimeout(tick, 0);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            controller?.abort();
        };
    }, [runId, following]);

    return { run, error, stopped };
}
