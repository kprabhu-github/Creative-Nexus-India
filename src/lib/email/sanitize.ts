// Sanitize email HTML before storing or rendering.
// Email is hostile input — every attribute and tag is opt-in.
//
// Defense in depth: we sanitize at write time (sync + send routes) AND callers
// render via `dangerouslySetInnerHTML` trusting the stored bytes. If you bypass
// this function, you bypass the only guard between sender-controlled HTML and
// an authenticated admin's browser.

import DOMPurify from "isomorphic-dompurify";
import { convert } from "html-to-text";

// Tags allowed in email bodies. Excludes: script, style, iframe, object, embed,
// form, input, button, base, link, meta, frame, frameset, applet, audio, video,
// source, track, svg, math (interactive/loadable surfaces).
const ALLOWED_TAGS = [
  "a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4",
  "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "small", "span",
  "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead",
  "tr", "u", "ul",
];

// Attributes allowed. Notably NOT: style, class, formaction, srcdoc,
// background, on*, data-*, base, target=_self (open redirect surface).
const ALLOWED_ATTR = [
  "href", "src", "alt", "title", "width", "height", "align", "valign",
  "colspan", "rowspan", "cellpadding", "cellspacing", "border",
  "bgcolor", "color", "size", "face",
];

// Only allow http(s), mailto, tel, and cid (inline image references).
// Blocks javascript:, data: (except images, opted in via ADD_DATA_URI_TAGS),
// vbscript:, file:, etc.
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel|cid):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

export function sanitizeEmailHtml(html: string): string {
  // NOTE: Do NOT set USE_PROFILES here. USE_PROFILES overrides ALLOWED_TAGS
  // and ALLOWED_ATTR with DOMPurify's built-in HTML profile, voiding the
  // explicit allowlist below. The FORBID lists are kept as belt-and-suspenders.
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: [
      "script", "style", "iframe", "object", "embed", "form", "input",
      "button", "base", "link", "meta", "frame", "frameset", "applet",
      "audio", "video", "source", "track", "svg", "math",
    ],
    FORBID_ATTR: [
      "style", "class", "formaction", "srcdoc", "background", "target",
      "onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur",
      "onchange", "onsubmit", "onreset", "onkeydown", "onkeyup", "onkeypress",
      "onmouseenter", "onmouseleave", "onmousedown", "onmouseup",
    ],
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
    SANITIZE_DOM: true,
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
