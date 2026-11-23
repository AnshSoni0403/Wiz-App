import { memo, useMemo } from "react";
import { renderMarkdown } from "../utils/markdown";

/**
 * Renders assistant markdown. `renderMarkdown` escapes ALL input HTML before adding its own
 * fixed set of tags, so the string set below can never contain markup from the answer text.
 */
const Markdown = ({ text, className = "" }) => {
    const html = useMemo(() => renderMarkdown(text), [text]);
    return <div className={`markdown ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default memo(Markdown);
