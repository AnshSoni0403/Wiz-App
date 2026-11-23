import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../../api/proposals.api";
import Icon from "../../components/Icon";
import Markdown from "../../components/Markdown";
import TopBar from "../../components/TopBar";
import { useAuth } from "../../context/AuthContext";
import { friendlyMessage, toApiError } from "../../utils/errors";
import "../../styles/proposals.css";

const MODES = [
    ["full", "Full proposal"], ["technical", "Technical"], ["commercial", "Commercial"], ["short", "Short quotation"],
];
const BRANCHES = { IN: "India", UK: "United Kingdom", KE: "Kenya" };
const titleOf = (draft) => draft.answers.title || draft.answers.customer || "Untitled proposal";
const answerText = (value) => {
    if (Array.isArray(value)) return value.join(", ");
    if (value && typeof value === "object") return Object.entries(value).map(([name, qty]) => `${name} × ${qty}`).join(", ");
    return value ?? "To confirm";
};
const docsLink = (value) => {
    try {
        const url = new URL(value);
        return url.origin === "https://docs.google.com" && url.pathname.startsWith("/document/") ? url.href : null;
    } catch { return null; }
};

function AnswerForm({ question, initial, busy, onSave, onCancel }) {
    const [text, setText] = useState(Array.isArray(initial) ? initial.join(", ") : typeof initial === "object" ? "" : initial ?? "");
    const [picked, setPicked] = useState(Array.isArray(initial) ? initial : []);
    const [counts, setCounts] = useState(initial && typeof initial === "object" && !Array.isArray(initial) ? initial : {});
    const { type, options = [], items = [] } = question;
    const quantities = Object.fromEntries(items.filter(name => counts[name]).map(name => [name, Number(counts[name])]));
    const single = type === "single" && options.length > 0;
    const multi = type === "multi" && options.length > 0;
    const value = multi ? picked : type === "quantities" ? quantities : type === "integer" ? Number(text)
        : type === "text-list" || type === "multi" ? String(text).split(",").map(part => part.trim()).filter(Boolean) : text;
    const ready = Array.isArray(value) ? value.length > 0 : type === "quantities" ? Object.keys(quantities).length > 0 : String(text).trim().length > 0;
    return (
        <form onSubmit={event => { event.preventDefault(); if (ready) onSave(value, false); }}>
            <fieldset disabled={busy} className="proposal-question">
                <legend>{question.label}</legend>
                {single || multi ? <div className="proposal-choices">
                    {options.map(option => {
                        const active = single ? option === text : picked.includes(option);
                        return <button key={option} type="button" aria-pressed={active} onClick={() => {
                            if (single) setText(option);
                            else if (active) setPicked(picked.filter(item => item !== option));
                            else if (["None", "Unknown"].includes(option)) setPicked([option]);
                            else setPicked([...picked.filter(item => !["None", "Unknown"].includes(item)), option]);
                        }}>{option}</button>;
                    })}
                </div> : type === "quantities" ? <div className="proposal-quantity">
                    {items.map(name => <label key={name}>{name}<input type="number" min="1" step="1" inputMode="numeric"
                        value={counts[name] ?? ""} onChange={event => setCounts({ ...counts, [name]: event.target.value })} /></label>)}
                </div> : type === "integer" ? <input aria-label={question.label} type="number" min="1" step="1" inputMode="numeric" value={text}
                    onChange={event => setText(event.target.value)} /> : <textarea aria-label={question.label} rows="3" maxLength="1000"
                    placeholder={type === "text-list" || type === "multi" ? "Separate detections with commas" : "Enter your answer"}
                    value={text} onChange={event => setText(event.target.value)} />}
                <div className="proposal-actions">
                    <button className="btn btn--primary" disabled={!ready}>{onCancel ? "Save changes" : "Save and continue"}</button>
                    <button className="btn btn--secondary" type="button" onClick={() => onSave(null, true)}>Answer later</button>
                    {onCancel && <button className="btn btn--ghost" type="button" onClick={onCancel}>Cancel</button>}
                </div>
            </fieldset>
        </form>
    );
}

function Review({ draft, busy, run }) {
    const [mode, setMode] = useState(draft.generated?.mode || "full");
    const [pricing, setPricing] = useState(null);
    const [pricingError, setPricingError] = useState("");
    useEffect(() => {
        const abort = new AbortController();
        setPricing(null);
        setPricingError("");
        api.getProposalPricing(draft.id, abort.signal).then(setPricing).catch(error => {
            if (!abort.signal.aborted) setPricingError(friendlyMessage(error));
        });
        return () => abort.abort();
    }, [draft.id, draft.revision]);
    const generated = draft.generated;
    const doc = draft.googleDoc;
    const url = docsLink(doc?.url);
    return <>
        <section className="proposal-card">
            <h2>Price Master</h2>
            {pricingError ? <p role="alert">{pricingError}</p> : !pricing ? <p role="status">Checking licence prices…</p>
                : pricing.lines?.length ? <ul className="proposal-prices">{pricing.lines.map(line =>
                    <li key={line.detectionId}><span>{line.detection}</span><strong>{line.unitPriceText}</strong></li>)}</ul>
                    : <p>No licence prices yet for this draft.</p>}
            {!!pricing?.unpriced?.length && <p>Missing prices for {pricing.unpriced.join(", ")}.</p>}
        </section>
        <section className="proposal-card">
            <h2>Write the proposal</h2>
            <label htmlFor="proposal-format">Proposal format</label>
            <select id="proposal-format" value={mode} disabled={busy} onChange={event => setMode(event.target.value)}>
                {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <div className="proposal-actions"><button className="btn btn--primary" disabled={busy} onClick={() => run("Writing proposal…", () => api.writeProposal(draft.id, mode))}>
                {generated ? "Rewrite proposal" : "Write proposal"}
            </button></div>
            {generated && !generated.current && <p>Details changed after this version was written.</p>}
            {generated?.checks?.length > 0 && <details className="proposal-details"><summary>Review notes ({generated.checks.length})</summary>
                <ul>{generated.checks.map((check, index) => <li key={index}>{check.message || check.label || check.text}</li>)}</ul>
            </details>}
            {generated?.markdown && <div className="proposal-document"><Markdown text={generated.markdown} /></div>}
        </section>
        <section className="proposal-card">
            <h2>Google Docs</h2>
            {doc && !doc.current && <p>Details changed since this Doc was created.</p>}
            {!!doc?.remaining?.length && <p>{doc.remaining.length} fields still need to be filled in the Doc.</p>}
            <div className="proposal-actions">
                {url && <a className="btn btn--primary" href={url} target="_blank" rel="noreferrer">Open Google Doc</a>}
                {(!doc?.current || doc.source !== "template") && <button className="btn btn--secondary" disabled={busy}
                    onClick={() => run("Creating Google Doc…", () => api.createProposalDoc(draft.id, "template"))}>Create from template</button>}
                {generated?.current && (!doc?.current || doc.source !== "generated") && <button className="btn btn--secondary" disabled={busy}
                    onClick={() => run("Creating Google Doc…", () => api.createProposalDoc(draft.id, "generated"))}>Export written draft</button>}
            </div>
        </section>
    </>;
}

function DraftView({ draft, busy, run }) {
    const [section, setSection] = useState("details");
    const [edit, setEdit] = useState(null);
    const [message, setMessage] = useState("");
    const current = edit || draft.question;
    const answered = draft.answered || [];
    const deferred = answered.filter(question => draft.answers[question.id] == null).length;
    const save = (value, defer) => run("Saving answer…", () => api.answerProposal(draft.id, {
        revision: draft.revision, questionId: current.id, value, defer,
    }), () => setEdit(null));
    return <>
        <header className="proposal-heading">
            <Link to="/proposals" className="proposal-back">‹ All drafts</Link>
            <h1>{titleOf(draft)}</h1>
            <p>{BRANCHES[draft.branch] || draft.branch} · {answered.length - deferred} answers saved{deferred ? ` · ${deferred} to confirm` : ""}</p>
        </header>
        <nav className="proposal-tabs" aria-label="Proposal workflow">
            {[["details", "Details"], ["chat", "Ask Wizz"], ["review", "Review & export"]].map(([id, label]) =>
                <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)} disabled={busy}>{label}</button>)}
        </nav>
        {section === "details" && <section className="proposal-card">
            {current ? <AnswerForm key={`${draft.revision}-${current.id}`} question={current} initial={draft.answers[current.id]} busy={busy}
                onSave={save} onCancel={edit ? () => setEdit(null) : null} />
                : <><h2>Review your details</h2><p>{deferred ? "You can fill in deferred answers below." : "Your brief is ready to review."}</p>
                    <button className="btn btn--primary" onClick={() => setSection("review")} disabled={busy}>Review & export</button></>}
            {answered.length > 0 && <details className="proposal-details" open={edit ? true : undefined}>
                <summary>Saved answers ({answered.length})</summary>
                <ul className="proposal-answers">{answered.map(question => <li key={question.id}>
                    <div><strong>{question.label}</strong><span>{answerText(draft.answers[question.id])}</span></div>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEdit(question)} disabled={busy}>Edit</button>
                </li>)}</ul>
            </details>}
        </section>}
        {section === "chat" && <section className="proposal-card">
            <h2>Ask Wizz about this draft</h2>
            {!draft.chat?.length && <p>Paste a brief or ask Wizz to update a detail. For example, “Set the site count to two and add email alerts.”</p>}
            <ol className="proposal-chat" aria-label="Draft conversation">{draft.chat?.map((turn, index) =>
                <li key={`${turn.at}-${index}`} className={turn.role === "user" ? "proposal-chat__user" : undefined}>
                    <strong>{turn.role === "user" ? "You" : "Wizz"}</strong><Markdown text={turn.text} />
                </li>)}</ol>
            <form onSubmit={event => {
                event.preventDefault();
                if (message.trim()) run("Wizz is working…", () => api.chatProposal(draft.id, {
                    message: message.trim(), revision: draft.revision,
                }), () => { setMessage(""); setEdit(null); });
            }}>
                <label htmlFor="proposal-chat-input">Message</label>
                <textarea id="proposal-chat-input" rows="3" maxLength="8000" value={message} disabled={busy} onChange={event => setMessage(event.target.value)} />
                <div className="proposal-actions"><button className="btn btn--primary" disabled={busy || !message.trim()}><Icon name="send" size={16} /> Send</button></div>
            </form>
        </section>}
        {section === "review" && <Review draft={draft} busy={busy} run={run} />}
    </>;
}

export default function ProposalsPage() {
    const { wizz } = useAuth();
    const { draftId } = useParams();
    const navigate = useNavigate();
    const [drafts, setDrafts] = useState(null);
    const [branch, setBranch] = useState("");
    const [problem, setProblem] = useState("");
    const [busy, setBusy] = useState("");
    const [reload, setReload] = useState(0);
    const [conflict, setConflict] = useState(false);
    const branches = (wizz?.branches || []).map(item => typeof item === "string" ? item : item.code)
        .filter(code => Object.hasOwn(BRANCHES, code));
    const chosenBranch = branches.includes(branch) ? branch : branches.length === 1 ? branches[0] : "";
    const draft = drafts?.find(item => item.id === draftId);
    useEffect(() => {
        const abort = new AbortController();
        api.listProposals(abort.signal).then(setDrafts).catch(error => {
            if (!abort.signal.aborted) {
                setProblem(friendlyMessage(error));
                setDrafts([]);
            }
        });
        return () => abort.abort();
    }, [reload]);
    const run = async (label, operation, onDone) => {
        if (busy || conflict) return;
        setBusy(label);
        setProblem("");
        try {
            const saved = await operation();
            setDrafts(items => [saved, ...(items || []).filter(item => item.id !== saved.id)]);
            onDone?.(saved);
        } catch (error) {
            setProblem(friendlyMessage(error));
            setConflict(toApiError(error).status === 409);
        } finally { setBusy(""); }
    };
    const refresh = () => { setConflict(false); setProblem(""); setDrafts(null); setReload(value => value + 1); };
    return <div className="page proposal-page">
        <TopBar title="Proposals" />
        <div className="proposal-scroll">
            <div className="proposal-content" aria-busy={Boolean(busy) || !drafts}>
                {problem && <div className="proposal-alert" role="alert">{problem} <button className="link-btn" onClick={refresh} disabled={Boolean(busy)}>Reload drafts</button></div>}
                {busy && <p className="proposal-status" role="status">{busy}</p>}
                {!drafts ? <p className="proposal-status" role="status">Loading drafts…</p> : draftId ? draft
                    ? <DraftView key={draft.id} draft={draft} busy={Boolean(busy) || conflict} run={run} />
                    : <section className="proposal-card"><h1>Draft unavailable</h1><Link to="/proposals">Back to your drafts</Link></section>
                    : <>
                        <section className="proposal-hero">
                            <Icon name="proposal" size={31} />
                            <h1>Make a proposal</h1>
                            <p>Capture the brief, review licence prices, and prepare a Google Doc.</p>
                            <form className="proposal-start" onSubmit={event => {
                                event.preventDefault();
                                if (chosenBranch) run("Creating draft…", () => api.startProposal(chosenBranch), saved => navigate(`/proposals/${saved.id}`));
                            }}>
                                <label htmlFor="proposal-branch">Branch</label>
                                <div className="proposal-actions"><select id="proposal-branch" value={chosenBranch} disabled={Boolean(busy)} onChange={event => setBranch(event.target.value)}>
                                    <option value="">{branches.length ? "Choose a branch" : "No branches available"}</option>
                                    {branches.map(code => <option key={code} value={code}>{BRANCHES[code]}</option>)}
                                </select><button className="btn btn--primary" disabled={Boolean(busy) || !chosenBranch}><Icon name="plus" size={18} /> New proposal</button></div>
                            </form>
                        </section>
                        <h2 className="proposal-list-title">Your drafts</h2>
                        {!drafts.length && <p className="proposal-empty">Your saved proposals will appear here.</p>}
                        <ul className="proposal-list">{drafts.map(item => <li key={item.id}><Link to={`/proposals/${item.id}`}>
                            <Icon name="proposal" size={22} /><div><strong>{titleOf(item)}</strong>
                                <span>{BRANCHES[item.branch] || item.branch} · {item.googleDoc?.current ? "Google Doc ready" : item.generated ? "Written draft" : "Draft"}</span></div>
                            <span aria-hidden="true">›</span>
                        </Link></li>)}</ul>
                    </>}
            </div>
        </div>
    </div>;
}
