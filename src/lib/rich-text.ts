/**
 * Simple Rich Text parser for ActiveCAMT
 * Supports:
 * **bold** -> <b>
 * [text](url) -> <a href="url" target="_blank">
 * {{color:HEX|text}} -> <span style="color:HEX">
 */
export function parseRichText(text: string): string {
  if (!text) return "";

  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Colors: {{color:#FF0000|text}}
  // Use a loop to handle nested tags correctly (inner-out)
  while (html.includes("{{color:") && html.includes("|") && html.includes("}}")) {
    const nextHtml = html.replace(/\{\{color:([^|]*?)\|((?:(?!\{\{color:).)*?)\}\}/g, '<span style="color:$1">$2</span>');
    if (nextHtml === html) break; // Prevent infinite loop if syntax is broken
    html = nextHtml;
  }

  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  // Links: [text](url) — only http/https/mailto survive. Anything else
  // (javascript:, data:, vbscript:, …) would execute in the reader's browser
  // when clicked, so the markup is left as plain text instead.
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, (match, label, url) => {
    let protocol: string;
    try {
      protocol = new URL(url, "https://placeholder.invalid").protocol;
    } catch {
      return match;
    }
    if (!["http:", "https:", "mailto:"].includes(protocol)) return match;
    // The earlier &/</> escaping can't catch a quote inside the URL breaking
    // out of the href attribute; neutralize it here.
    const safeUrl = url.replace(/"/g, "%22");
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary); text-decoration: underline;">${label}</a>`;
  });

  // Newlines
  html = html.replace(/\n/g, "<br />");

  return html;
}

/**
 * Plain-text version of rich text, for previews/snippets (e.g. product cards).
 * Strips the markup tokens, keeping the visible text, and collapses whitespace.
 */
export function stripRichText(text: string): string {
  if (!text) return "";

  let out = text;
  // Colors: {{color:#hex|text}} -> text (loop to unwrap nested tags inner-out).
  while (out.includes("{{color:") && out.includes("|") && out.includes("}}")) {
    const next = out.replace(/\{\{color:([^|]*?)\|((?:(?!\{\{color:).)*?)\}\}/g, "$2");
    if (next === out) break;
    out = next;
  }
  out = out.replace(/\*\*(.*?)\*\*/g, "$1"); // bold
  out = out.replace(/\[(.*?)\]\((.*?)\)/g, "$1"); // links -> label only

  return out.replace(/\s+/g, " ").trim();
}
