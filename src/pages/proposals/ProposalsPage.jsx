import {
    Accordion,
    ActionIcon,
    Alert,
    Badge,
    Button,
    Card,
    Chip,
    Drawer,
    Group,
    Loader,
    Modal,
    NumberInput,
    Paper,
    SegmentedControl,
    Select,
    Skeleton,
    Stack,
    Table,
    Text,
    Textarea,
    ThemeIcon,
    Title,
    UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
    IconAlertTriangle,
    IconArrowUp,
    IconBrandGoogleDrive,
    IconChevronRight,
    IconReceipt2,
    IconExternalLink,
    IconFileDescription,
    IconFileExport,
    IconListDetails,
    IconMessageChatbot,
    IconPencil,
    IconPlus,
    IconRefresh,
    IconWand,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../../api/proposals.api";
import Markdown from "../../components/Markdown";
import TopBar from "../../components/TopBar";
import { useAuth } from "../../context/AuthContext";
import { friendlyMessage, toApiError } from "../../utils/errors";
import { relativeTime } from "../../utils/format";
import "../../styles/proposals.css";

const MODES = [
    { value: "full", label: "Full proposal" },
    { value: "technical", label: "Technical" },
    { value: "commercial", label: "Commercial" },
    { value: "short", label: "Short quotation" },
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
    } catch {
        return null;
    }
};
const stageOf = (item) =>
    item.googleDoc?.current ? { label: "Google Doc ready", color: "teal" } : item.generated ? { label: "Written", color: "blue" } : { label: "Draft", color: "gray" };

// ------------------------------------------------------------------ question form

function AnswerForm({ question, initial, busy, onSave, onCancel }) {
    const [text, setText] = useState(Array.isArray(initial) ? initial.join(", ") : typeof initial === "object" ? "" : initial ?? "");
    const [picked, setPicked] = useState(Array.isArray(initial) ? initial : []);
    const [counts, setCounts] = useState(initial && typeof initial === "object" && !Array.isArray(initial) ? initial : {});
    const { type, options = [], items = [] } = question;
    const quantities = Object.fromEntries(items.filter((name) => counts[name]).map((name) => [name, Number(counts[name])]));
    const single = type === "single" && options.length > 0;
    const multi = type === "multi" && options.length > 0;
    const value = multi
        ? picked
        : type === "quantities"
          ? quantities
          : type === "integer"
            ? Number(text)
            : type === "text-list" || type === "multi"
              ? String(text)
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean)
              : text;
    const ready = Array.isArray(value) ? value.length > 0 : type === "quantities" ? Object.keys(quantities).length > 0 : String(text).trim().length > 0;

    const pickMulti = (next) => {
        // "None" / "Unknown" exclude every other option.
        const added = next.find((o) => !picked.includes(o));
        if (added && ["None", "Unknown"].includes(added)) setPicked([added]);
        else setPicked(next.filter((o) => !["None", "Unknown"].includes(o) || next.length === 1));
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                if (ready) onSave(value, false);
            }}
        >
            <fieldset disabled={busy} className="proposal-question">
                <Text component="legend" fw={600} size="md" mb="sm">
                    {question.label}
                </Text>
                {single ? (
                    <Chip.Group value={text} onChange={setText}>
                        <Group gap={6}>
                            {options.map((option) => (
                                <Chip key={option} value={option} radius="md" variant="outline">
                                    {option}
                                </Chip>
                            ))}
                        </Group>
                    </Chip.Group>
                ) : multi ? (
                    <Chip.Group multiple value={picked} onChange={pickMulti}>
                        <Group gap={6}>
                            {options.map((option) => (
                                <Chip key={option} value={option} radius="md" variant="outline">
                                    {option}
                                </Chip>
                            ))}
                        </Group>
                    </Chip.Group>
                ) : type === "quantities" ? (
                    <Stack gap={6}>
                        {items.map((name) => (
                            <Group key={name} justify="space-between" wrap="nowrap" className="proposal-qty">
                                <Text size="sm">{name}</Text>
                                <NumberInput
                                    aria-label={name}
                                    min={1}
                                    step={1}
                                    allowDecimal={false}
                                    w={110}
                                    placeholder="0"
                                    value={counts[name] ?? ""}
                                    onChange={(v) => setCounts({ ...counts, [name]: v === "" ? "" : String(v) })}
                                />
                            </Group>
                        ))}
                    </Stack>
                ) : type === "integer" ? (
                    <NumberInput aria-label={question.label} min={1} step={1} allowDecimal={false} value={text} onChange={(v) => setText(v === "" ? "" : String(v))} />
                ) : (
                    <Textarea
                        aria-label={question.label}
                        minRows={3}
                        maxRows={8}
                        maxLength={1000}
                        placeholder={type === "text-list" || type === "multi" ? "Separate items with commas" : "Type your answer"}
                        value={text}
                        onChange={(event) => setText(event.currentTarget.value)}
                    />
                )}
                <div className="proposal-actionbar">
                    {onCancel ? (
                        <Button variant="subtle" color="gray" onClick={onCancel}>
                            Cancel
                        </Button>
                    ) : null}
                    <Button variant="default" onClick={() => onSave(null, true)}>
                        Answer later
                    </Button>
                    <Button type="submit" disabled={!ready} className="proposal-actionbar__primary">
                        {onCancel ? "Save changes" : "Save & continue"}
                    </Button>
                </div>
            </fieldset>
        </form>
    );
}

// ------------------------------------------------------------------ review & export

function Review({ draft, busy, run }) {
    const [mode, setMode] = useState(draft.generated?.mode || "full");
    const [pricing, setPricing] = useState(null);
    const [pricingError, setPricingError] = useState("");
    useEffect(() => {
        const abort = new AbortController();
        setPricing(null);
        setPricingError("");
        api.getProposalPricing(draft.id, abort.signal)
            .then(setPricing)
            .catch((error) => {
                if (!abort.signal.aborted) setPricingError(friendlyMessage(error));
            });
        return () => abort.abort();
    }, [draft.id, draft.revision]);
    const generated = draft.generated;
    const doc = draft.googleDoc;
    const url = docsLink(doc?.url);
    return (
        <Stack gap="sm">
            <Card>
                <SectionTitle icon={IconReceipt2} title="Licence prices" />
                {pricingError ? (
                    <Alert color="red" p="xs" role="alert">
                        {pricingError}
                    </Alert>
                ) : !pricing ? (
                    <Stack gap={6} role="status" aria-label="Checking licence prices">
                        <Skeleton height={14} />
                        <Skeleton height={14} width="80%" />
                    </Stack>
                ) : pricing.lines?.length ? (
                    <Table verticalSpacing={6} fz="sm" className="proposal-prices">
                        <Table.Tbody>
                            {pricing.lines.map((line) => (
                                <Table.Tr key={line.detectionId}>
                                    <Table.Td>{line.detection}</Table.Td>
                                    <Table.Td ta="right" fw={600}>
                                        {line.unitPriceText}
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                ) : (
                    <Text size="sm" c="dimmed">
                        No licence prices yet for this draft.
                    </Text>
                )}
                {pricing?.unpriced?.length ? (
                    <Text size="xs" c="orange.8" mt={6}>
                        Missing prices for {pricing.unpriced.join(", ")}.
                    </Text>
                ) : null}
            </Card>

            <Card>
                <SectionTitle icon={IconWand} title="Write the proposal" />
                <Group align="flex-end" gap="xs" wrap="nowrap">
                    <Select label="Format" data={MODES} value={mode} onChange={(v) => v && setMode(v)} disabled={busy} allowDeselect={false} style={{ flex: 1 }} />
                    <Button leftSection={<IconWand size={16} />} disabled={busy} onClick={() => run("Writing proposal…", () => api.writeProposal(draft.id, mode))}>
                        {generated ? "Rewrite" : "Write"}
                    </Button>
                </Group>
                {generated && !generated.current ? (
                    <Alert color="yellow" p="xs" mt="xs">
                        Details changed after this version was written.
                    </Alert>
                ) : null}
                {generated?.checks?.length > 0 ? (
                    <Accordion variant="contained" mt="xs" radius="md">
                        <Accordion.Item value="notes">
                            <Accordion.Control>Review notes ({generated.checks.length})</Accordion.Control>
                            <Accordion.Panel>
                                <ul className="proposal-notes">
                                    {generated.checks.map((check, index) => (
                                        <li key={index}>{check.message || check.label || check.text}</li>
                                    ))}
                                </ul>
                            </Accordion.Panel>
                        </Accordion.Item>
                    </Accordion>
                ) : null}
                {generated?.markdown ? (
                    <Paper withBorder p="sm" mt="xs" radius="md" className="proposal-document">
                        <Markdown text={generated.markdown} />
                    </Paper>
                ) : null}
            </Card>

            <Card>
                <SectionTitle icon={IconBrandGoogleDrive} title="Google Docs" />
                {doc && !doc.current ? (
                    <Text size="sm" c="orange.8">
                        Details changed since this Doc was created.
                    </Text>
                ) : null}
                {doc?.remaining?.length ? (
                    <Text size="sm" c="dimmed">
                        {doc.remaining.length} fields still need to be filled in the Doc.
                    </Text>
                ) : null}
                <Stack gap="xs" mt="xs">
                    {url ? (
                        <Button component="a" href={url} target="_blank" rel="noreferrer" rightSection={<IconExternalLink size={15} />} fullWidth>
                            Open Google Doc
                        </Button>
                    ) : null}
                    {!doc?.current || doc.source !== "template" ? (
                        <Button variant="default" leftSection={<IconFileDescription size={16} />} disabled={busy} fullWidth onClick={() => run("Creating Google Doc…", () => api.createProposalDoc(draft.id, "template"))}>
                            Create from template
                        </Button>
                    ) : null}
                    {generated?.current && (!doc?.current || doc.source !== "generated") ? (
                        <Button variant="default" leftSection={<IconFileExport size={16} />} disabled={busy} fullWidth onClick={() => run("Creating Google Doc…", () => api.createProposalDoc(draft.id, "generated"))}>
                            Export written draft
                        </Button>
                    ) : null}
                </Stack>
            </Card>
        </Stack>
    );
}

const SectionTitle = ({ icon: SIcon, title, right = null }) => (
    <Group gap="xs" mb="xs" wrap="nowrap">
        <ThemeIcon variant="light" radius="md" size={26}>
            <SIcon size={15} stroke={1.75} />
        </ThemeIcon>
        <Text fw={600} size="sm" style={{ flex: 1 }}>
            {title}
        </Text>
        {right}
    </Group>
);

// ------------------------------------------------------------------ draft workspace

function DraftChat({ draft, busy, run, onDone }) {
    const [message, setMessage] = useState("");
    const send = () => {
        if (message.trim())
            run("Wizz is working…", () => api.chatProposal(draft.id, { message: message.trim(), revision: draft.revision }), () => {
                setMessage("");
                onDone?.();
            });
    };
    return (
        <Card>
            <SectionTitle icon={IconMessageChatbot} title="Ask Wizz about this draft" />
            {!draft.chat?.length ? (
                <Text size="sm" c="dimmed" mb="sm">
                    Paste a brief or ask Wizz to update a detail — for example “Set the site count to two and add email alerts.”
                </Text>
            ) : null}
            <ol className="proposal-chat" aria-label="Draft conversation">
                {draft.chat?.map((turn, index) => (
                    <li key={`${turn.at}-${index}`} className={turn.role === "user" ? "proposal-chat__user" : "proposal-chat__wizz"}>
                        <span className="sr-only">{turn.role === "user" ? "You" : "Wizz"}: </span>
                        <Markdown text={turn.text} />
                    </li>
                ))}
            </ol>
            <form
                className="composer"
                onSubmit={(event) => {
                    event.preventDefault();
                    send();
                }}
            >
                <div className="composer__box">
                    <Textarea
                        className="composer__input"
                        variant="unstyled"
                        autosize
                        minRows={1}
                        maxRows={6}
                        maxLength={8000}
                        placeholder="Message Wizz…"
                        aria-label="Message"
                        value={message}
                        disabled={busy}
                        onChange={(event) => setMessage(event.currentTarget.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                send();
                            }
                        }}
                    />
                    <ActionIcon type="submit" variant="filled" radius="xl" size={36} disabled={busy || !message.trim()} aria-label="Send">
                        <IconArrowUp size={19} stroke={2.2} />
                    </ActionIcon>
                </div>
            </form>
        </Card>
    );
}

function DraftView({ draft, busy, run }) {
    const [section, setSection] = useState("details");
    const [edit, setEdit] = useState(null);
    const current = edit || draft.question;
    const answered = draft.answered || [];
    const deferred = answered.filter((question) => draft.answers[question.id] == null).length;
    const save = (value, defer) =>
        run("Saving answer…", () => api.answerProposal(draft.id, { revision: draft.revision, questionId: current.id, value, defer }), () => setEdit(null));
    return (
        <Stack gap="sm">
            <Group gap={6}>
                <Badge variant="light" color="gold">
                    {BRANCHES[draft.branch] || draft.branch}
                </Badge>
                <Badge variant="light" color="teal">
                    {answered.length - deferred} answered
                </Badge>
                {deferred ? (
                    <Badge variant="light" color="orange">
                        {deferred} to confirm
                    </Badge>
                ) : null}
                {draft.updatedAt ? (
                    <Text size="xs" c="dimmed">
                        Updated {relativeTime(draft.updatedAt)}
                    </Text>
                ) : null}
            </Group>

            <SegmentedControl
                aria-label="Proposal steps"
                value={section}
                onChange={setSection}
                disabled={busy}
                size="sm"
                data={[
                    { value: "details", label: <StepLabel icon={IconListDetails} text="Details" /> },
                    { value: "chat", label: <StepLabel icon={IconMessageChatbot} text="Ask Wizz" /> },
                    { value: "review", label: <StepLabel icon={IconFileExport} text="Export" /> },
                ]}
            />

            {section === "details" ? (
                <Stack gap="sm">
                    <Card>
                        {current ? (
                            <AnswerForm
                                key={`${draft.revision}-${current.id}`}
                                question={current}
                                initial={draft.answers[current.id]}
                                busy={busy}
                                onSave={save}
                                onCancel={edit ? () => setEdit(null) : null}
                            />
                        ) : (
                            <Stack gap="xs" align="flex-start">
                                <Title order={3}>Brief complete</Title>
                                <Text size="sm" c="dimmed">
                                    {deferred ? "You can fill in deferred answers below." : "Your brief is ready to review."}
                                </Text>
                                <Button rightSection={<IconChevronRight size={16} />} onClick={() => setSection("review")} disabled={busy}>
                                    Review & export
                                </Button>
                            </Stack>
                        )}
                    </Card>
                    {answered.length > 0 ? (
                        <Accordion variant="contained" radius="lg" defaultValue={edit ? "answers" : null} className="proposal-answers">
                            <Accordion.Item value="answers">
                                <Accordion.Control>
                                    <Text size="sm" fw={600}>
                                        Saved answers ({answered.length})
                                    </Text>
                                </Accordion.Control>
                                <Accordion.Panel>
                                    <ul className="proposal-answer-list">
                                        {answered.map((question) => (
                                            <li key={question.id}>
                                                <div className="proposal-answer-list__text">
                                                    <Text size="xs" c="dimmed">
                                                        {question.label}
                                                    </Text>
                                                    <Text size="sm" fw={500}>
                                                        {answerText(draft.answers[question.id])}
                                                    </Text>
                                                </div>
                                                <ActionIcon onClick={() => setEdit(question)} disabled={busy} aria-label={`Edit ${question.label}`}>
                                                    <IconPencil size={16} stroke={1.75} />
                                                </ActionIcon>
                                            </li>
                                        ))}
                                    </ul>
                                </Accordion.Panel>
                            </Accordion.Item>
                        </Accordion>
                    ) : null}
                </Stack>
            ) : null}
            {section === "chat" ? <DraftChat draft={draft} busy={busy} run={run} onDone={() => setEdit(null)} /> : null}
            {section === "review" ? <Review draft={draft} busy={busy} run={run} /> : null}
        </Stack>
    );
}

const StepLabel = ({ icon: SIcon, text }) => (
    <span className="step-label">
        <SIcon size={15} stroke={1.75} />
        <span>{text}</span>
    </span>
);

// ------------------------------------------------------------------ list & new proposal

function NewProposal({ opened, onClose, branches, busy, onCreate }) {
    const desktop = useMediaQuery("(min-width: 768px)");
    const [branch, setBranch] = useState(branches.length === 1 ? branches[0] : "");
    useEffect(() => {
        if (opened) setBranch(branches.length === 1 ? branches[0] : "");
    }, [opened, branches]);
    const body = (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                Capture the brief, review licence prices and prepare a Google Doc.
            </Text>
            {branches.length ? (
                <SegmentedControl
                    aria-label="Branch"
                    value={branch}
                    onChange={setBranch}
                    size="sm"
                    data={branches.map((code) => ({ value: code, label: BRANCHES[code] }))}
                />
            ) : (
                <Alert color="yellow" p="xs">
                    No branches are available for proposals on your account.
                </Alert>
            )}
            <Button fullWidth leftSection={<IconPlus size={17} />} disabled={busy || !branch} loading={busy} onClick={() => onCreate(branch)}>
                Create proposal
            </Button>
        </Stack>
    );
    return desktop ? (
        <Modal opened={opened} onClose={onClose} title={<Text fw={600}>New proposal</Text>}>
            {body}
        </Modal>
    ) : (
        <Drawer opened={opened} onClose={onClose} position="bottom" size="auto" title={<Text fw={600}>New proposal</Text>} className="sheet-drawer">
            {body}
        </Drawer>
    );
}

function DraftList({ drafts }) {
    if (!drafts.length) {
        return (
            <Stack align="center" gap="xs" py={48}>
                <ThemeIcon variant="light" radius="xl" size={52}>
                    <IconFileDescription size={26} stroke={1.5} />
                </ThemeIcon>
                <Text fw={600}>No proposals yet</Text>
                <Text size="sm" c="dimmed" ta="center" maw={280}>
                    Tap the + button to start your first proposal.
                </Text>
            </Stack>
        );
    }
    return (
        <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Your drafts
            </Text>
            {drafts.map((item) => {
                const stage = stageOf(item);
                return (
                    <UnstyledButton key={item.id} component={Link} to={`/proposals/${item.id}`} className="proposal-row">
                        <ThemeIcon variant="light" radius="md" size={38}>
                            <IconFileDescription size={20} stroke={1.6} />
                        </ThemeIcon>
                        <div className="proposal-row__text">
                            <Text fw={600} size="sm" truncate>
                                {titleOf(item)}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                                {[BRANCHES[item.branch] || item.branch, item.updatedAt ? relativeTime(item.updatedAt) : null].filter(Boolean).join(" · ")}
                            </Text>
                        </div>
                        <Badge color={stage.color}>{stage.label}</Badge>
                        <IconChevronRight size={16} className="proposal-row__chevron" />
                    </UnstyledButton>
                );
            })}
        </Stack>
    );
}

export default function ProposalsPage() {
    const { wizz } = useAuth();
    const { draftId } = useParams();
    const navigate = useNavigate();
    const [drafts, setDrafts] = useState(null);
    const [problem, setProblem] = useState("");
    const [busy, setBusy] = useState("");
    const [reload, setReload] = useState(0);
    const [conflict, setConflict] = useState(false);
    const [creating, setCreating] = useState(false);
    const branches = (wizz?.branches || []).map((item) => (typeof item === "string" ? item : item.code)).filter((code) => Object.hasOwn(BRANCHES, code));
    const draft = drafts?.find((item) => item.id === draftId);
    useEffect(() => {
        const abort = new AbortController();
        api.listProposals(abort.signal)
            .then(setDrafts)
            .catch((error) => {
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
            setDrafts((items) => [saved, ...(items || []).filter((item) => item.id !== saved.id)]);
            onDone?.(saved);
        } catch (error) {
            setProblem(friendlyMessage(error));
            setConflict(toApiError(error).status === 409);
        } finally {
            setBusy("");
        }
    };
    const refresh = () => {
        setConflict(false);
        setProblem("");
        setDrafts(null);
        setReload((value) => value + 1);
    };

    const inDraft = Boolean(draftId);
    const topTitle = inDraft ? (draft ? titleOf(draft) : "Proposal") : "Proposals";

    return (
        <div className="page proposal-page">
            <TopBar title={topTitle} subtitle={inDraft ? "Proposal draft" : null} back={inDraft ? "/proposals" : null}>
                {!inDraft ? (
                    <ActionIcon onClick={refresh} aria-label="Reload drafts" color="dark" disabled={Boolean(busy) || !drafts}>
                        <IconRefresh size={19} stroke={1.75} />
                    </ActionIcon>
                ) : null}
            </TopBar>
            <div className="page__body" aria-busy={Boolean(busy) || !drafts}>
                {problem ? (
                    <Alert color="red" icon={<IconAlertTriangle size={18} />} role="alert">
                        <Group justify="space-between" gap="xs">
                            <Text size="sm">{problem}</Text>
                            <Button size="compact-sm" variant="light" color="red" onClick={refresh} disabled={Boolean(busy)}>
                                Reload
                            </Button>
                        </Group>
                    </Alert>
                ) : null}
                {busy ? (
                    <Paper withBorder radius="md" px="sm" py={8} className="proposal-busy" role="status">
                        <Group gap="xs">
                            <Loader size={16} />
                            <Text size="sm">{busy}</Text>
                        </Group>
                    </Paper>
                ) : null}

                {!drafts ? (
                    <Stack gap="xs" role="status" aria-label="Loading drafts">
                        {[1, 2, 3].map((k) => (
                            <Skeleton key={k} height={62} radius="lg" />
                        ))}
                    </Stack>
                ) : inDraft ? (
                    draft ? (
                        <DraftView key={draft.id} draft={draft} busy={Boolean(busy) || conflict} run={run} />
                    ) : (
                        <Stack align="center" gap="xs" py={48}>
                            <Text fw={600}>Draft unavailable</Text>
                            <Button component={Link} to="/proposals" variant="light">
                                Back to your drafts
                            </Button>
                        </Stack>
                    )
                ) : (
                    <DraftList drafts={drafts} />
                )}
            </div>

            {!inDraft ? (
                <ActionIcon className="fab" size={54} radius="xl" variant="filled" aria-label="New proposal" onClick={() => setCreating(true)} disabled={Boolean(busy)}>
                    <IconPlus size={24} stroke={2} />
                </ActionIcon>
            ) : null}
            <NewProposal
                opened={creating}
                onClose={() => setCreating(false)}
                branches={branches}
                busy={Boolean(busy)}
                onCreate={(branch) =>
                    run("Creating draft…", () => api.startProposal(branch), (saved) => {
                        setCreating(false);
                        navigate(`/proposals/${saved.id}`);
                    })
                }
            />
        </div>
    );
}
