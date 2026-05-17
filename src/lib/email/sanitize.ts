// Sanitize email HTML before storing or rendering.
// Strips scripts, event handlers, javascript: URLs; keeps inline styles + images.
// Image src rewriting (tracking-pixel proxy) is Phase 2.

import DOMPurify from "isomorphic-dompurify";
import { convert } from "html-to-text";

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
    ALLOW_DATA_ATTR: false,
  });
}

export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: 80,
    selectors: [
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
    ],
  });
}
