/**
 * Research Agent API (shared contract, "HTTP API"). Every path here must also be allowed in
 * api/wizz-proxy.js, otherwise the Vercel deployment answers 404.
 */
import api, { unwrap } from "./client";

const root = "/api/v1/wizz/research";
const id = (value) => encodeURIComponent(value);

/** `{ stats, recentReports, activeRuns, provider, defaults, permissions }` */
export const getResearchOverview = async (signal) => unwrap(await api.get(`${root}/overview`, { signal }));

/** `{ items: [Card], total, page, pageSize }` - params: `branch, mode, status, q, page, pageSize`. */
export const listResearchReports = async (params, signal) =>
    unwrap(await api.get(`${root}/reports`, { params, signal }));

/** Full report: Card + content, sources, failures, runs, links, canEdit, canApprove. */
export const getResearchReport = async (reportId, signal) => unwrap(await api.get(`${root}/reports/${id(reportId)}`, { signal }));

/** One run, used for live progress while it is queued / researching / drafting. */
export const getResearchRun = async (runId, signal) => unwrap(await api.get(`${root}/runs/${id(runId)}`, { signal }));

/** `{ job, run }` - a one-off job runs immediately. */
export const createResearchJob = async (body) => unwrap(await api.post(`${root}/jobs`, body));

/** `{ run }` - runs the report's job again (depth "deep" = deepen). */
export const refreshResearchReport = async (reportId, body = {}) =>
    unwrap(await api.post(`${root}/reports/${id(reportId)}/refresh`, body));
