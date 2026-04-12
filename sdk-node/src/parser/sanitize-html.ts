import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  // Structure
  "div",
  "span",
  "p",
  "br",
  "hr",
  // Text formatting
  "b",
  "i",
  "u",
  "strong",
  "em",
  "small",
  "sub",
  "sup",
  "s",
  "strike",
  // Headings
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  // Lists
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  // Tables
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "colgroup",
  "col",
  "caption",
  // Links and images
  "a",
  "img",
  // Semantic
  "blockquote",
  "pre",
  "code",
  "address",
  "center",
  // Legacy but common in email
  "font",
  "big",
];

const ALLOWED_ATTRS = [
  "class",
  "id",
  "dir",
  "lang",
  "href",
  "title",
  "target",
  "rel",
  "src",
  "alt",
  "width",
  "height",
  "border",
  "cellpadding",
  "cellspacing",
  "align",
  "valign",
  "bgcolor",
  "colspan",
  "rowspan",
  "span",
  "color",
  "size",
  "face",
];

// Allow https, safe raster data:image/ (for inline CID images), mailto, and
// fragment links. Block data:image/svg+xml (can contain embedded JS) and all
// other data: schemes (text/html, etc.).
const ALLOWED_URI_REGEXP =
  /^(https?:|data:image\/(?!svg\+xml)[a-z0-9][a-z0-9+.-]*[;,]|mailto:|cid:|#)/i;

// Register hooks once at module load to avoid race conditions when
// multiple calls to sanitizeHtml run concurrently.
const SVG_DATA_URI_RE = /^data:image\/svg\+xml/i;

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName.startsWith("on")) {
    data.keepAttr = false;
  }
  if (data.attrName === "style") {
    data.keepAttr = false;
  }
  // Block data:image/svg+xml URIs — SVG can contain embedded JavaScript.
  // DOMPurify's DATA_URI_TAGS allowlist bypasses ALLOWED_URI_REGEXP for
  // img src, so we must strip it in the hook.
  if (
    (data.attrName === "src" || data.attrName === "href") &&
    SVG_DATA_URI_RE.test(data.attrValue)
  ) {
    data.keepAttr = false;
  }
});

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    const target = node.getAttribute("target");
    if (target === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  }
});

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ALLOWED_ATTRS,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOWED_URI_REGEXP,
  FORBID_TAGS: [
    "style",
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "link",
    "meta",
    "base",
    "svg",
    "math",
  ],
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
}
