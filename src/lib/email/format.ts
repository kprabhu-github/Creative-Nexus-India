// Convert plain-text body (paragraphs separated by blank lines) to styled HTML.
// Inline styles are required — email clients strip CSS classes.

export function plainTextToHtml(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return paragraphs
    .map((p) => {
      const withBreaks = p.replace(/\n/g, "<br />");
      return `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.7;color:#333;">${withBreaks}</p>`;
    })
    .join("\n");
}
