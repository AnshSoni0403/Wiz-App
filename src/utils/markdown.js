/**
 * Tiny, safe markdown renderer for assistant answers.
 *
 * Safety model: the WHOLE input is HTML-escaped first, so nothing the model (or the knowledge
 * base) writes can become markup. Afterwards only a fixed set of tags is produced by this file
 * (p, br, strong, em, del, code, pre, h3-h6, ul, ol, li, blockquote, hr, table parts, a).
 * Link targets are restricted to http(s), mailto and same-origin absolute paths, and are
 * re-escaped before being placed in an attribute.
 *
 * Supported: paragraphs, line breaks, **bold**, *italic*, ~~strike~~, `code`, fenced code blocks,
 * headings, bullet / numbered lists (nested by indentation), blockquotes, rules, simple pipe tables,
 * [links](https://...) and bare https:// URLs.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const UNESCAPES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
const unescapeHtml = (value) => value.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => UNESCAPES[m]);

const SAFE_URL = /^(?:https?:\/\/|mailto:|\/(?!\/))/i;

/** Returns an attribute-safe href or null when the URL is not allowed. */
export const safeHref = (url) => {
    const raw = String(url ?? "").trim();
    if (!raw || !SAFE_URL.test(raw)) return null;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f\s]/.test(raw)) return null;
    return escapeHtml(raw);
};

const linkHtml = (href, labelHtml) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`;

const renderEmphasis = (s) =>
    s
        .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, "<strong>$1</strong>")
        .replace(/__(?=\S)([^\n]*?\S)__/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?![*\w])/g, "$1<em>$2</em>")
        .replace(/~~(?=\S)([^\n]*?\S)~~/g, "<del>$1</del>");

const TOKEN = /\u0000(\d+)\u0000/;
const TOKENS = /\u0000(\d+)\u0000/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;
const BARE_URL = /https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s\u0000])+/g;

/** Renders one line of already-escaped text. */
const renderInline = (escaped) => {
    const stash = [];
    const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
    let s = escaped;

    // `code` first so nothing inside it is formatted.
    s = s.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${code}</code>`));

    // [label](url)
    s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/g, (match, label, url) => {
        const href = safeHref(unescapeHtml(url));
        const labelHtml = renderEmphasis(label);
        return href ? keep(linkHtml(href, labelHtml)) : labelHtml;
    });

    // Bare URLs.
    s = s.replace(BARE_URL, (match) => {
        const trailing = match.match(TRAILING_PUNCTUATION)?.[0] || "";
        const url = trailing ? match.slice(0, -trailing.length) : match;
        const href = safeHref(unescapeHtml(url));
        return href ? keep(linkHtml(href, url)) + trailing : match;
    });

    s = renderEmphasis(s);

    for (let i = 0; i < 5 && TOKEN.test(s); i += 1) {
        s = s.replace(TOKENS, (_, n) => stash[Number(n)] ?? "");
    }
    return s;
};

const renderInlineLines = (text) => text.split("\n").map(renderInline).join("<br>");

const LIST_ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const FENCE = /^\s{0,3}(```|~~~)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}&gt;\s?(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const splitRow = (line) =>
    line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());

const buildList = (items, from, indent) => {
    const first = items[from];
    const tag = first.ordered ? "ol" : "ul";
    const start = first.ordered && first.number > 1 ? ` start="${first.number}"` : "";
    let html = `<${tag}${start}>`;
    let j = from;
    while (j < items.length && items[j].indent >= indent) {
        const item = items[j];
        if (item.indent > indent && html.endsWith("</li>")) {
            const nested = buildList(items, j, item.indent);
            html = `${html.slice(0, -"</li>".length)}${nested.html}</li>`;
            j = nested.next;
            continue;
        }
        html += `<li>${renderInlineLines(item.text)}</li>`;
        j += 1;
    }
    return { html: `${html}</${tag}>`, next: j };
};

/** Renders markdown to a sanitised HTML string. */
export const renderMarkdown = (source) => {
    const text = String(source ?? "")
        // eslint-disable-next-line no-control-regex
        .replace(/\u0000/g, "")
        .replace(/\r\n?/g, "\n");
    const lines = escapeHtml(text).split("\n");
    const out = [];
    let paragraph = [];

    const flushParagraph = () => {
        if (paragraph.length) {
            out.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
            paragraph = [];
        }
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        const fence = line.match(FENCE);
        if (fence) {
            flushParagraph();
            const code = [];
            i += 1;
            while (i < lines.length && !lines[i].trim().startsWith(fence[1])) {
                code.push(lines[i]);
                i += 1;
            }
            i += 1; // closing fence
            out.push(`<pre><code>${code.join("\n")}</code></pre>`);
            continue;
        }

        if (!line.trim()) {
            flushParagraph();
            i += 1;
            continue;
        }

        const heading = line.match(HEADING);
        if (heading) {
            flushParagraph();
            const level = Math.min(6, heading[1].length + 2);
            out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
            i += 1;
            continue;
        }

        if (RULE.test(line)) {
            flushParagraph();
            out.push("<hr>");
            i += 1;
            continue;
        }

        if (QUOTE.test(line)) {
            flushParagraph();
            const quoted = [];
            while (i < lines.length && QUOTE.test(lines[i])) {
                quoted.push(lines[i].match(QUOTE)[1]);
                i += 1;
            }
            out.push(`<blockquote><p>${quoted.map(renderInline).join("<br>")}</p></blockquote>`);
            continue;
        }

        if (line.includes("|") && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1])) {
            flushParagraph();
            const header = splitRow(line);
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
                rows.push(splitRow(lines[i]));
                i += 1;
            }
            const head = header.map((c) => `<th>${renderInline(c)}</th>`).join("");
            const body = rows
                .map((row) => `<tr>${header.map((_, c) => `<td>${renderInline(row[c] ?? "")}</td>`).join("")}</tr>`)
                .join("");
            out.push(`<div class="md-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
            continue;
        }

        if (LIST_ITEM.test(line)) {
            flushParagraph();
            const items = [];
            while (i < lines.length) {
                const current = lines[i];
                const m = current.match(LIST_ITEM);
                if (m) {
                    const item = {
                        indent: m[1].replace(/\t/g, "    ").length,
                        ordered: /\d/.test(m[2]),
                        number: parseInt(m[2], 10) || 1,
                        text: m[3],
                    };
                    // A top-level item of the other kind (bullets vs numbers) starts a new list.
                    if (items.length && item.indent <= items[0].indent && item.ordered !== items[0].ordered) break;
                    items.push(item);
                    i += 1;
                    continue;
                }
                if (current.trim() && /^\s{2,}/.test(current) && items.length) {
                    items[items.length - 1].text += `\n${current.trim()}`;
                    i += 1;
                    continue;
                }
                if (!current.trim()) {
                    let k = i + 1;
                    while (k < lines.length && !lines[k].trim()) k += 1;
                    if (k < lines.length && LIST_ITEM.test(lines[k])) {
                        i = k;
                        continue;
                    }
                }
                break;
            }
            const base = Math.min(...items.map((it) => it.indent));
            items.forEach((it) => {
                it.indent = Math.max(it.indent, base);
            });
            out.push(buildList(items, 0, base).html);
            continue;
        }

        paragraph.push(line);
        i += 1;
    }
    flushParagraph();
    return out.join("");
};
