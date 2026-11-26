/**
 * Research started from chat. The PWA only follows a run's progress; the answer itself arrives
 * as a new assistant message in the same conversation. This path must also be allowed in
 * api/wizz-proxy.js, otherwise the Vercel deployment answers 404.
 */
import api, { unwrap } from "./client";

/** `{ id, status, progress: { stage, percent, message }, reportId, error }` */
export const getResearchRun = async (runId, signal) =>
    unwrap(await api.get(`/api/v1/wizz/research/runs/${encodeURIComponent(runId)}`, { signal }));
