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

  // Links: [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: var(--accent-primary); text-decoration: underline;">$1</a>');

  // Newlines
  html = html.replace(/\n/g, "<br />");

  return html;
}
