import api, { unwrap } from "./client";

const root = "/api/v1/wizz/proposals";
const draft = (id) => `${root}/${encodeURIComponent(id)}`;
const longRequest = { timeout: 120000 };

export const listProposals = async (signal) => unwrap(await api.get(root, { signal }));
export const startProposal = async (branch) => unwrap(await api.post(root, { branch }));
export const answerProposal = async (id, body) => unwrap(await api.patch(`${draft(id)}/answer`, body));
export const chatProposal = async (id, body) => unwrap(await api.post(`${draft(id)}/chat`, body, longRequest));
export const getProposalPricing = async (id, signal) => unwrap(await api.get(`${draft(id)}/pricing`, { signal }));
export const writeProposal = async (id, mode) => unwrap(await api.post(`${draft(id)}/write`, { mode }, longRequest));
export const createProposalDoc = async (id, source) => unwrap(await api.post(`${draft(id)}/google-doc`, { source }, longRequest));
