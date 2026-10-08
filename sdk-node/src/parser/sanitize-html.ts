import sanitizeHtmlLib, { type IOptions } from "sanitize-html";

// HTML sanitizer for parsed email bodies.
//
// Implemented with `sanitize-html` (a pure-JS, htmlparser2-based allow-list
// sanitizer) rather than DOMPurify. DOMPurify needs a live DOM: in the browser
// that's `window`, and `isomorphic-dompurify` supplies a jsdom one for Node —
// but jsdom is heavy and, critically, cannot run on edge/Workers runtimes (no
// DOM, and pure-JS DOM shims either crash at init or silently no-op, which
// would ship unsanitized HTML). `sanitize-html` needs no DOM, so the same
// sanitizer runs in the browser, Node, and Workers from one implementation.
// The allow-list policy below is preserved from the prior DOMPurify config.

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

// data:image/svg+xml can carry embedded JavaScript, so it is blocked on src/href
// even though other (raster) data:image/* is allowed for inline CID images.
const SVG_DATA_URI_RE = /^data:image\/svg\+xml/i;

// Tags whose entire contents are dropped (not just the tag), so e.g.
// `<script>`/`<style>` text never survives. Mirrors DOMPurify removing these
// wholesale. Extends sanitize-html's default nonTextTags with the dangerous
// container tags that are not in ALLOWED_TAGS.
const NON_TEXT_TAGS = [
  "script",
  "style",
  "textarea",
  "option",
  "noscript",
  "title",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "form",
  "select",
  "button",
  "input",
];

// Content the sender hid from readers. Dropping `style` attributes and
// `<style>` blocks (above) would otherwise make it visible: a preheader or a
// prompt injection in a display:none div would render in the inbox and reach
// every consumer of body_html as ordinary text. Such elements are therefore
// discarded with their contents, before their styles are stripped.
//
// Only declarations that hide an element and everything inside it, with no
// way for a descendant to show again, are honoured: display:none, zero
// opacity, the `hidden` attribute, and a zero-height box with overflow hidden.
// visibility:hidden and font-size:0 are not, since a descendant can reset
// them (email builders put font-size:0 on layout wrappers routinely), and
// neither is mso-hide, which only Outlook applies.
function declarations(style: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of style.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const value = part
      .slice(i + 1)
      .replace(/!\s*important/i, "")
      .trim()
      .toLowerCase();
    if (prop) out.set(prop, value);
  }
  return out;
}

const ZERO = /^0+(\.0+)?(px|pt|em|rem|%)?$/;

function hidesByStyle(d: Map<string, string>): boolean {
  if (d.get("display") === "none") return true;
  const opacity = d.get("opacity");
  if (opacity !== undefined && Number.parseFloat(opacity) === 0) return true;
  const clipped = /hidden|clip/.test(
    `${d.get("overflow") ?? ""} ${d.get("overflow-y") ?? ""}`,
  );
  return (
    clipped && ["max-height", "height"].some((p) => ZERO.test(d.get(p) ?? "x"))
  );
}

/**
 * Class names a document's own stylesheet hides outright: rules outside any
 * @media block whose selector is a single class (optionally tag-qualified).
 * Rules inside media queries only apply to some screens, so they are ignored.
 */
function hiddenClasses(html: string): Set<string> {
  const out = new Set<string>();
  const sheets = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  for (const sheet of sheets) {
    let css = sheet
      .replace(/^<style\b[^>]*>|<\/style>$/gi, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    // Remove @-blocks (media queries and the like) including their nested rules.
    for (
      let at = css.search(/@[a-z-]+[^{;]*\{/i);
      at >= 0;
      at = css.search(/@[a-z-]+[^{;]*\{/i)
    ) {
      let depth = 0;
      let end = css.indexOf("{", at);
      for (; end < css.length; end++) {
        if (css[end] === "{") depth++;
        else if (css[end] === "}" && --depth === 0) break;
      }
      css = css.slice(0, at) + css.slice(end + 1);
    }
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!hidesByStyle(declarations(m[2] ?? ""))) continue;
      for (const sel of (m[1] ?? "").split(",")) {
        const cls = sel.trim().match(/^[a-z0-9]*\.([\w-]+)$/i);
        if (cls?.[1]) out.add(cls[1]);
      }
    }
  }
  return out;
}

function optionsFor(html: string): IOptions {
  const hidden = hiddenClasses(html);
  // Attribute objects of hidden elements. transformTags sees each element's
  // original attributes; exclusiveFilter runs when it closes and removes it
  // with everything inside. The allow-list strips attributes in place, so the
  // object identity carries the decision from one hook to the other.
  const hiddenElements = new WeakSet<object>();
  return {
    ...OPTIONS,
    transformTags: {
      ...OPTIONS.transformTags,
      "*": (tagName, attribs) => {
        const inline = declarations(attribs.style ?? "");
        const byClass =
          hidden.size > 0 &&
          (attribs.class ?? "").split(/\s+/).some((c) => hidden.has(c)) &&
          !(inline.has("display") && inline.get("display") !== "none");
        const next = { ...attribs };
        if ("hidden" in attribs || hidesByStyle(inline) || byClass)
          hiddenElements.add(next);
        return { tagName, attribs: next };
      },
    },
    exclusiveFilter: (frame) => hiddenElements.has(frame.attribs),
  };
}

const OPTIONS: IOptions = {
  allowedTags: ALLOWED_TAGS,
  // DOMPurify's ALLOWED_ATTR was a global allow-list; "*" applies it to every
  // tag. Event handlers (on*), `style`, and data-* attributes are absent from
  // the list and so are dropped — matching ALLOW_DATA_ATTR:false plus the prior
  // on*/style strip hooks.
  allowedAttributes: { "*": ALLOWED_ATTRS },
  // https / mailto / cid plus fragment and relative URLs (no scheme). data: is
  // permitted only on <img> (below). Protocol-relative ("//host") URLs are
  // rejected. Equivalent to ALLOW_UNKNOWN_PROTOCOLS:false + the ALLOWED_URI
  // policy.
  allowedSchemes: ["http", "https", "mailto", "cid"],
  allowedSchemesByTag: { img: ["http", "https", "cid", "data"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  nonTextTags: NON_TEXT_TAGS,
  disallowedTagsMode: "discard",
  transformTags: {
    // `target` is intentionally not in the allow-list (matches the prior
    // sanitizer: target=_blank is stripped, defeating window.opener attacks).
    // `data:` is already rejected on <a> (not in its allowed schemes), so only
    // <img> needs the explicit data:image/svg+xml guard below.
    img: (tagName, attribs) => {
      const next: Record<string, string> = { ...attribs };
      if (next.src && SVG_DATA_URI_RE.test(next.src)) {
        delete next.src;
      }
      return { tagName, attribs: next };
    },
  },
};

export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, optionsFor(html));
}
