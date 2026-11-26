import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon";
import { createResearchJob } from "../../api/research.api";
import { fieldErrorLines, friendlyMessage } from "../../utils/errors";
import { branchName } from "../../utils/format";

const MAX_QUESTION = 4000;
const RESOLUTIONS = ["720p", "1080p", "4MP", "4K"];
const SIZING_FIELDS = [
    ["cameras", "Cameras", "60"],
    ["analysisFps", "Analysis FPS per camera", "10"],
    ["modelsPerCamera", "Detections per camera", "3"],
    ["retentionDays", "Retention (days)", "30"],
];
const EMPTY_SIZING = { cameras: "", resolution: "", analysisFps: "", modelsPerCamera: "", retentionDays: "" };

const splitList = (value) =>
    String(value || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 20);

/**
 * "New research" bottom sheet: a one-off job (POST /wizz/research/jobs, schedule "once").
 * Schedules, watchlists and limits stay in the Admin wizard. Native <dialog> gives focus trapping,
 * Escape to close and an inert page behind it.
 */
const NewResearchSheet = ({ open, onClose, onCreated, createBranches, defaultBranch, branches }) => {
    const dialogRef = useRef(null);
    const submittingRef = useRef(false);
    const [mode, setMode] = useState("competitor");
    const [branch, setBranch] = useState("");
    const [depth, setDepth] = useState("brief");
    const [question, setQuestion] = useState("");
    const [competitors, setCompetitors] = useState("");
    const [countries, setCountries] = useState("");
    const [sizing, setSizing] = useState(EMPTY_SIZING);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState("");

    const chosenBranch = createBranches.includes(branch) ? branch : createBranches.includes(defaultBranch) ? defaultBranch : createBranches[0] || "";

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            setProblem("");
            if (typeof dialog.showModal === "function") dialog.showModal();
            else dialog.setAttribute("open", "");
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    // Escape closes the native dialog; keep the parent's state in step.
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;
        const onCancel = (event) => {
            if (submittingRef.current) event.preventDefault();
        };
        const onDialogClose = () => onClose();
        dialog.addEventListener("cancel", onCancel);
        dialog.addEventListener("close", onDialogClose);
        return () => {
            dialog.removeEventListener("cancel", onCancel);
            dialog.removeEventListener("close", onDialogClose);
        };
    }, [onClose]);

    const sizingTouched = mode === "general" && Object.values(sizing).some((value) => String(value).trim());
    const sizingComplete =
        Boolean(sizing.resolution) &&
        SIZING_FIELDS.every(([key]) => {
            const n = Number(sizing[key]);
            // Retention may be 0 (live analysis only, no recording), as on the server.
            return String(sizing[key]).trim() !== "" && Number.isFinite(n) && (key === "retentionDays" ? n >= 0 : n > 0);
        });
    const trimmed = question.trim();
    const ready = Boolean(chosenBranch) && trimmed.length >= 10 && (!sizingTouched || sizingComplete);

    const submit = async (event) => {
        event.preventDefault();
        if (!ready || submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setProblem("");
        const inputs = {};
        if (mode === "competitor" && splitList(competitors).length) inputs.competitors = splitList(competitors);
        if (splitList(countries).length) inputs.countries = splitList(countries);
        if (sizingTouched) {
            inputs.sizing = {
                cameras: Number(sizing.cameras),
                resolution: sizing.resolution,
                analysisFps: Number(sizing.analysisFps),
                modelsPerCamera: Number(sizing.modelsPerCamera),
                retentionDays: Number(sizing.retentionDays),
            };
        }
        try {
            const data = await createResearchJob({
                mode,
                branch: chosenBranch,
                depth,
                question: trimmed,
                inputs,
                schedule: { frequency: "once" },
                origin: "pwa",
            });
            const run = data?.run && typeof data.run === "object" ? { title: data?.job?.title, ...data.run } : null;
            setQuestion("");
            setCompetitors("");
            setCountries("");
            setSizing(EMPTY_SIZING);
            submittingRef.current = false;
            onCreated(run);
            dialogRef.current?.close();
        } catch (error) {
            const details = fieldErrorLines(error);
            setProblem(details.length ? `${friendlyMessage(error)} ${details.join("; ")}.` : friendlyMessage(error));
        } finally {
            submittingRef.current = false;
            setBusy(false);
        }
    };

    return (
        <dialog ref={dialogRef} className="research-sheet" aria-labelledby="research-sheet-title">
            <form onSubmit={submit} className="research-sheet__form">
                <div className="research-sheet__head">
                    <h2 id="research-sheet-title">New research</h2>
                    <button type="button" className="icon-btn" onClick={() => dialogRef.current?.close()} aria-label="Close" disabled={busy}>
                        <Icon name="close" size={20} />
                    </button>
                </div>
                <fieldset disabled={busy} className="research-sheet__body">
                    <fieldset className="research-field">
                        <legend>What kind of research?</legend>
                        <div className="research-choices">
                            {[
                                ["competitor", "Competitor analysis", "Products, prices, news and changes for named companies."],
                                ["general", "General research", "Market, technology or country questions, and server sizing."],
                            ].map(([value, label, hint]) => (
                                <label key={value} className="research-choice">
                                    <input type="radio" name="research-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                                    <span>
                                        <strong>{label}</strong>
                                        <small>{hint}</small>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <div className="research-field">
                        <label htmlFor="research-question">Question</label>
                        <textarea
                            id="research-question"
                            rows="4"
                            maxLength={MAX_QUESTION}
                            required
                            value={question}
                            aria-describedby="research-question-hint"
                            placeholder={
                                mode === "competitor"
                                    ? "e.g. Compare the top five video analytics companies in Kenya on products, pricing and recent news"
                                    : "e.g. Which AI video analytics rules apply to retail stores in the UK?"
                            }
                            onChange={(event) => setQuestion(event.target.value)}
                        />
                        <small id="research-question-hint" className="research-muted">
                            At least 10 characters. {question.length}/{MAX_QUESTION}
                        </small>
                    </div>

                    {mode === "competitor" ? (
                        <div className="research-field">
                            <label htmlFor="research-competitors">Competitors (optional)</label>
                            <input
                                id="research-competitors"
                                value={competitors}
                                placeholder="Separate names with commas"
                                onChange={(event) => setCompetitors(event.target.value)}
                            />
                        </div>
                    ) : null}

                    <div className="research-field">
                        <label htmlFor="research-countries">Countries (optional)</label>
                        <input
                            id="research-countries"
                            value={countries}
                            placeholder="e.g. Kenya, Uganda"
                            onChange={(event) => setCountries(event.target.value)}
                        />
                    </div>

                    {mode === "general" ? (
                        <details className="research-field research-sizing" open={sizingTouched || undefined}>
                            <summary>Server sizing inputs (optional)</summary>
                            <p className="research-muted">Fill all five to get a sized configuration with calculations.</p>
                            <div className="research-sizing__grid">
                                {SIZING_FIELDS.map(([key, label, example]) => (
                                    <label key={key}>
                                        {label}
                                        <input
                                            type="number"
                                            // The server accepts fractional analysis FPS (0.1-120); the others are whole numbers.
                                            min={key === "analysisFps" ? "0.1" : key === "retentionDays" ? "0" : "1"}
                                            step={key === "analysisFps" ? "any" : "1"}
                                            inputMode={key === "analysisFps" ? "decimal" : "numeric"}
                                            placeholder={example}
                                            value={sizing[key]}
                                            onChange={(event) => setSizing({ ...sizing, [key]: event.target.value })}
                                        />
                                    </label>
                                ))}
                                <label>
                                    Resolution
                                    <select value={sizing.resolution} onChange={(event) => setSizing({ ...sizing, resolution: event.target.value })}>
                                        <option value="">Choose</option>
                                        {RESOLUTIONS.map((value) => (
                                            <option key={value} value={value}>
                                                {value}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            {sizingTouched && !sizingComplete ? (
                                <p className="research-note research-note--warn">Fill in all five sizing inputs, or clear them.</p>
                            ) : null}
                        </details>
                    ) : null}

                    <div className="research-row">
                        <div className="research-field">
                            <label htmlFor="research-branch">Branch</label>
                            <select id="research-branch" value={chosenBranch} onChange={(event) => setBranch(event.target.value)}>
                                {createBranches.map((code) => (
                                    <option key={code} value={code}>
                                        {branchName(code, branches)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="research-field">
                            <label htmlFor="research-depth">Depth</label>
                            <select id="research-depth" value={depth} onChange={(event) => setDepth(event.target.value)}>
                                <option value="brief">Brief (default)</option>
                                <option value="deep">Deep: more sources, takes longer</option>
                            </select>
                        </div>
                    </div>

                    {problem ? (
                        <p className="research-alert" role="alert">
                            {problem}
                        </p>
                    ) : null}
                </fieldset>
                <div className="research-sheet__foot">
                    <button type="submit" className="btn btn--primary btn--block" disabled={busy || !ready}>
                        {busy ? "Starting…" : "Start research"}
                    </button>
                    <p className="research-muted">Runs once now. Recurring research and watchlists are set up in the Admin.</p>
                </div>
            </form>
        </dialog>
    );
};

export default NewResearchSheet;
