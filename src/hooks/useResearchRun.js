import { useCallback, useEffect, useState } from "react";
import { getResearchRun } from "../api/research.api";
import { toApiError } from "../utils/errors";
import { isActiveRun } from "../utils/research";

export const RUN_POLL_MS = 4000;

/**
 * Follows a research run: polls GET /wizz/research/runs/:id every 4 s while it is queued,
 * researching or drafting, and stops once it is ready, failed or cancelled.
 *
 * `seed` is what the caller already knows (a Run from the server, or the chat's `research`
 * summary). With `fetchFirst` the first request goes out immediately, because the seed may be
 * stale (an old chat message saved while the run was still queued).
 * Polling pauses while the page is hidden and stops on client errors that won't fix themselves
 * (403 / 404); `retry()` starts it again.
 */
export default function useResearchRun(runId, seed = null, { fetchFirst = false } = {}) {
    const [run, setRun] = useState(seed);
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);
    const status = run?.status;
    const following = Boolean(runId) && (!status || isActiveRun(status));
    const immediate = fetchFirst || attempt > 0;

    useEffect(() => {
        if (!following) return undefined;
        let stopped = false;
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
                if (stopped) return;
                setError(null);
                if (next && typeof next === "object") setRun((previous) => ({ ...(previous || {}), ...next }));
                // A finished run flips `following`, which tears this effect down.
                if (next?.status && !isActiveRun(next.status)) return;
            } catch (err) {
                if (stopped) return;
                const e = toApiError(err);
                if (e.kind === "cancelled") return;
                setError(e);
                if (e.kind === "http" && e.status >= 400 && e.status < 500 && e.status !== 429) return;
            }
            timer = window.setTimeout(tick, RUN_POLL_MS);
        };

        timer = window.setTimeout(tick, immediate ? 0 : RUN_POLL_MS);
        return () => {
            stopped = true;
            window.clearTimeout(timer);
            controller?.abort();
        };
    }, [runId, following, immediate, attempt]);

    const retry = useCallback(() => {
        setError(null);
        setAttempt((value) => value + 1);
    }, []);

    return { run, error, retry };
}
