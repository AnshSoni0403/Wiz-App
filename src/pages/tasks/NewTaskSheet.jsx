import { Button } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import Sheet from "../../components/Sheet";
import Icon from "../../components/Icon";
import { createTask, getDirectory } from "../../api/tasks.api";
import { friendlyMessage, toApiError } from "../../utils/errors";
import { PRIORITY_LABELS, newIdempotencyKey, todayInput } from "../../utils/tasks";

const blank = () => ({
    title: "",
    description: "",
    target: "person", // "self" | "person" | "team"
    assigneeIds: [],
    teamId: "",
    teamMode: "shared",
    due: "",
    dueTime: "",
    priority: "medium",
});

/**
 * Quick task creation. People who may assign pick one or more people, or a team with an explicit
 * choice between one shared task and one task per member; staff create tasks for themselves.
 * The idempotency key lives as long as the sheet is open, so a retried save never duplicates.
 */
const NewTaskSheet = ({ open, access, onClose, onCreated }) => {
    const canAssign = Boolean(access?.canAssignOthers || ["owner", "branch_head", "team_lead"].includes(access?.role));
    const selfId = access?.actor?.type === "EMPLOYEE" ? access.actor.id : null;
    const [form, setForm] = useState(blank);
    const [key, setKey] = useState(newIdempotencyKey);
    const [directory, setDirectory] = useState({ people: [], teams: [] });
    const [dirLoading, setDirLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return;
        setForm({ ...blank(), target: canAssign ? "person" : "self" });
        setKey(newIdempotencyKey());
        setError(null);
        setSearch("");
    }, [open, canAssign]);

    useEffect(() => {
        if (!open || !canAssign) return undefined;
        const controller = new AbortController();
        const t = window.setTimeout(() => {
            setDirLoading(true);
            getDirectory(search.trim(), { signal: controller.signal })
                .then((data) => setDirectory({ people: data?.people || [], teams: data?.teams || [] }))
                .catch((err) => {
                    if (toApiError(err).kind !== "cancelled") setError(err);
                })
                .finally(() => {
                    if (!controller.signal.aborted) setDirLoading(false);
                });
        }, 250);
        return () => {
            window.clearTimeout(t);
            controller.abort();
        };
    }, [open, canAssign, search]);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const togglePerson = (id) =>
        set({ assigneeIds: form.assigneeIds.includes(id) ? form.assigneeIds.filter((x) => x !== id) : [...form.assigneeIds, id] });
    const selectedTeam = useMemo(() => directory.teams.find((t) => t._id === form.teamId) || null, [directory.teams, form.teamId]);

    const missing =
        !form.title.trim() ||
        (form.target === "person" && !form.assigneeIds.length) ||
        (form.target === "team" && !form.teamId);

    const submit = async (e) => {
        e.preventDefault();
        if (missing || busy) return;
        setBusy(true);
        setError(null);
        const body = {
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            priority: form.priority,
            due: form.due || undefined,
            dueTime: form.due && form.dueTime ? form.dueTime : undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
            idempotencyKey: key,
        };
        if (form.target === "team") {
            body.teamId = form.teamId;
            body.teamMode = form.teamMode;
        } else if (form.target === "person") {
            body.assigneeIds = form.assigneeIds;
        } else if (selfId) {
            body.assigneeIds = [selfId];
        }
        try {
            const data = await createTask(body);
            onCreated(data);
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet
            open={open}
            title="New task"
            onClose={onClose}
            busy={busy}
            footer={
                <div className="row row--end">
                    <Button unstyled type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button unstyled type="submit" form="new-task-form" className="btn btn--primary" disabled={missing || busy}>
                        {busy ? "Saving…" : form.target === "team" && form.teamMode === "per_member" ? "Create tasks" : "Create task"}
                    </Button>
                </div>
            }
        >
            <form id="new-task-form" className="form" onSubmit={submit}>
                {error ? (
                    <div className="notice notice--danger" role="alert">
                        <Icon name="alert" size={16} />
                        <p>{friendlyMessage(error)}</p>
                    </div>
                ) : null}
                <label className="field">
                    <span className="field__label">What needs doing?</span>
                    <input
                        className="input"
                        data-autofocus
                        required
                        maxLength={200}
                        value={form.title}
                        onChange={(e) => set({ title: e.target.value })}
                        placeholder="e.g. Prepare the UK brochure"
                    />
                </label>
                <label className="field">
                    <span className="field__label">Details (optional)</span>
                    <textarea
                        className="input"
                        rows={2}
                        maxLength={5000}
                        value={form.description}
                        onChange={(e) => set({ description: e.target.value })}
                    />
                </label>

                {canAssign ? (
                    <fieldset className="field fieldset">
                        <legend className="field__label">Assign to</legend>
                        <div className="segmented segmented--sm" role="group" aria-label="Assign to">
                            <button type="button" aria-pressed={form.target === "person"} onClick={() => set({ target: "person" })}>
                                People
                            </button>
                            <button type="button" aria-pressed={form.target === "team"} onClick={() => set({ target: "team" })}>
                                A team
                            </button>
                            {selfId ? (
                                <button type="button" aria-pressed={form.target === "self"} onClick={() => set({ target: "self" })}>
                                    Me
                                </button>
                            ) : null}
                        </div>
                        {form.target !== "self" ? (
                            <label className="search-field search-field--compact">
                                <Icon name="search" size={16} />
                                <span className="sr-only">{form.target === "team" ? "Search teams" : "Search people"}</span>
                                <input
                                    type="search"
                                    className="input"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={form.target === "team" ? "Search teams" : "Search people"}
                                />
                            </label>
                        ) : null}
                        {form.target === "person" ? (
                            <div className="pick-list" role="group" aria-label="People" aria-busy={dirLoading}>
                                {directory.people.map((p) => (
                                    <label key={p._id} className={`pick ${form.assigneeIds.includes(p._id) ? "is-picked" : ""}`}>
                                        <input type="checkbox" checked={form.assigneeIds.includes(p._id)} onChange={() => togglePerson(p._id)} />
                                        <span className="pick__text">
                                            <span>{p.name}</span>
                                            <span className="muted small">{[p.branch, ...(p.teams || [])].filter(Boolean).join(" · ")}</span>
                                        </span>
                                    </label>
                                ))}
                                {!dirLoading && !directory.people.length ? <p className="muted small">No one matches.</p> : null}
                            </div>
                        ) : null}
                        {form.target === "team" ? (
                            <>
                                <div className="pick-list" role="radiogroup" aria-label="Team" aria-busy={dirLoading}>
                                    {directory.teams.map((t) => (
                                        <label key={t._id} className={`pick ${form.teamId === t._id ? "is-picked" : ""}`}>
                                            <input type="radio" name="team" checked={form.teamId === t._id} onChange={() => set({ teamId: t._id })} />
                                            <span className="pick__text">
                                                <span>
                                                    {t.name}
                                                    {t.branch ? ` (${t.branch})` : ""}
                                                </span>
                                                <span className="muted small">
                                                    {t.memberCount || 0} member{t.memberCount === 1 ? "" : "s"}
                                                    {t.leads?.length ? ` · lead ${t.leads.map((l) => l.name).join(", ")}` : ""}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                    {!dirLoading && !directory.teams.length ? <p className="muted small">No teams you can assign to.</p> : null}
                                </div>
                                {form.teamId ? (
                                    <div className="choice-cards" role="radiogroup" aria-label="How to assign the team">
                                        <label className={`choice-card ${form.teamMode === "shared" ? "is-picked" : ""}`}>
                                            <input type="radio" name="teamMode" checked={form.teamMode === "shared"} onChange={() => set({ teamMode: "shared" })} />
                                            <span>
                                                <strong>One shared task</strong>
                                                <span className="muted small">The whole team works on one task together.</span>
                                            </span>
                                        </label>
                                        <label className={`choice-card ${form.teamMode === "per_member" ? "is-picked" : ""}`}>
                                            <input
                                                type="radio"
                                                name="teamMode"
                                                checked={form.teamMode === "per_member"}
                                                onChange={() => set({ teamMode: "per_member" })}
                                            />
                                            <span>
                                                <strong>One task per member</strong>
                                                <span className="muted small">
                                                    {selectedTeam?.memberCount ? `${selectedTeam.memberCount} separate tasks, ` : ""}each person reports on their own.
                                                </span>
                                            </span>
                                        </label>
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                    </fieldset>
                ) : (
                    <p className="muted small">This task will be assigned to you.</p>
                )}

                <div className="field-row">
                    <label className="field">
                        <span className="field__label">Due date</span>
                        <input type="date" className="input" min={todayInput()} value={form.due} onChange={(e) => set({ due: e.target.value })} />
                    </label>
                    <label className="field">
                        <span className="field__label">Time (optional)</span>
                        <input type="time" className="input" value={form.dueTime} disabled={!form.due} onChange={(e) => set({ dueTime: e.target.value })} />
                    </label>
                </div>
                <label className="field">
                    <span className="field__label">Priority</span>
                    <select className="input" value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
            </form>
        </Sheet>
    );
};

export default NewTaskSheet;
