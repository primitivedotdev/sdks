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
// opacity, the `hidden` attribute, and a zero-height clipped box with no
// minimum height. visibility:hidden and font-size:0 are not, since a
// descendant can reset them (email builders put font-size:0 on layout
// wrappers routinely), and neither is mso-hide, which only Outlook applies.
//
// Stylesheet rules are honoured only for simple selectors (`.c`, `tag.c`,
// `.a.b`) outside @-blocks, resolved with the cascade: !important, then
// specificity, then source order, with inline declarations above normal
// stylesheet ones. Anything more complex is left alone, which errs towards
// keeping content.

interface Decl {
  value: string;
  important: boolean;
}

const RELEVANT = new Set([
  "display",
  "opacity",
  "overflow-x",
  "overflow-y",
  "height",
  "max-height",
  "min-height",
]);

const NUMBER = String.raw`[+-]?(\d+\.?\d*|\.\d+)`;
const LENGTH = new RegExp(
  `^${NUMBER}(px|pt|pc|in|cm|mm|q|em|rem|ex|ch|vw|vh|vmin|vmax|%)$`,
);
const BARE_NUMBER = new RegExp(`^${NUMBER}$`);
const BARE_ZERO = /^[+-]?(0+\.?0*|\.0+)$/;
const NUMERIC = /^[+-]?[\d.]/;

/**
 * A browser ignores a declaration whose value is malformed (`height:0foo`),
 * so it is ignored here too. Anything else is kept, including values this
 * code cannot compute (calc(), var(), keywords): those never count as hiding,
 * so an override it cannot evaluate errs towards keeping the content.
 */
function valid(prop: string, value: string): boolean {
  if (!NUMERIC.test(value)) return true;
  if (prop === "opacity")
    return BARE_NUMBER.test(value) || new RegExp(`^${NUMBER}%$`).test(value);
  if (prop.endsWith("height"))
    return LENGTH.test(value) || BARE_ZERO.test(value);
  return true;
}

const stripComments = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, " ");

function declarations(style: string): Map<string, Decl> {
  const out = new Map<string, Decl>();
  const set = (prop: string, value: string, important: boolean) => {
    if (!RELEVANT.has(prop) || !value || !valid(prop, value)) return;
    // Within one block a later declaration wins unless an earlier one is important and it is not.
    const prev = out.get(prop);
    if (!(prev?.important && !important)) out.set(prop, { value, important });
  };
  for (const part of stripComments(style).split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const name = part.slice(0, i).trim().toLowerCase();
    let value = part
      .slice(i + 1)
      .trim()
      .toLowerCase();
    const important = /!\s*important\s*$/.test(value);
    if (important) value = value.replace(/!\s*important\s*$/, "").trim();
    if (name === "overflow") {
      // Shorthand: one value for both axes, or horizontal then vertical.
      const [x = "", y = x] = value.split(/\s+/);
      set("overflow-x", x, important);
      set("overflow-y", y, important);
    } else set(name, value, important);
  }
  return out;
}

const isZero = (v: string): boolean =>
  BARE_ZERO.test(v) ||
  (LENGTH.test(v) && BARE_ZERO.test(v.replace(/[a-z%]+$/, "")));
const CLIPS = /^(hidden|clip|auto|scroll|overlay)$/;

/** Whether the box clips vertically. Per CSS, a visible axis becomes auto when the other axis is not visible or clip. */
function clipsVertically(d: Map<string, string>): boolean {
  const x = d.get("overflow-x") ?? "visible";
  const y = d.get("overflow-y") ?? "visible";
  if (y === "visible") return !/^(visible|clip)$/.test(x);
  return CLIPS.test(y);
}

function hidesByStyle(d: Map<string, string>): boolean {
  if (d.get("display") === "none") return true;
  const opacity = d.get("opacity");
  if (
    opacity !== undefined &&
    (BARE_NUMBER.test(opacity) || opacity.endsWith("%")) &&
    Number.parseFloat(opacity) === 0
  )
    return true;
  if (!clipsVertically(d)) return false;
  const minHeight = d.get("min-height");
  if (minHeight && !isZero(minHeight) && minHeight !== "auto") return false;
  return ["max-height", "height"].some((p) => isZero(d.get(p) ?? "x"));
}

interface Rule {
  tag: string;
  classes: string[];
  specificity: number;
  order: number;
  decls: Map<string, Decl>;
}

function removeAtBlocks(css: string): string {
  let out = css;
  for (
    let at = out.search(/@[a-z-]+[^{;]*\{/i);
    at >= 0;
    at = out.search(/@[a-z-]+[^{;]*\{/i)
  ) {
    let depth = 0;
    let end = out.indexOf("{", at);
    for (; end < out.length; end++) {
      if (out[end] === "{") depth++;
      else if (out[end] === "}" && --depth === 0) break;
    }
    out = out.slice(0, at) + out.slice(end + 1);
  }
  return out;
}

/** Rules from the message's own stylesheets whose selector is a tag and/or classes only. */
function classRules(html: string): Rule[] {
  const rules: Rule[] = [];
  const sheets = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  for (const sheet of sheets) {
    const css = removeAtBlocks(
      stripComments(sheet.replace(/^<style\b[^>]*>|<\/style>$/gi, "")),
    );
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decls = declarations(m[2] ?? "");
      if (!decls.size) continue;
      for (const sel of (m[1] ?? "").split(",")) {
        const simple = sel.trim().match(/^([a-z][a-z0-9]*)?((?:\.[\w-]+)+)$/i);
        if (!simple) continue;
        const classes = (simple[2] ?? "").split(".").filter(Boolean);
        rules.push({
          tag: (simple[1] ?? "").toLowerCase(),
          classes,
          specificity: classes.length * 1000 + (simple[1] ? 1 : 0),
          order: rules.length,
          decls,
        });
      }
    }
  }
  return rules;
}

/** The winning value of each relevant property for one element. */
function resolve(
  tagName: string,
  attribs: Record<string, string>,
  rules: Rule[],
): Map<string, string> {
  const own = new Set((attribs.class ?? "").split(/\s+/).filter(Boolean));
  const matched = rules
    .filter(
      (r) =>
        (!r.tag || r.tag === tagName.toLowerCase()) &&
        r.classes.every((c) => own.has(c)),
    )
    .sort((x, y) => x.specificity - y.specificity || x.order - y.order);
  const inline = declarations(attribs.style ?? "");
  const out = new Map<string, string>();
  // Cascade order, lowest first: normal stylesheet, normal inline, important stylesheet, important inline.
  const layers: Array<Array<Map<string, Decl>>> = [
    matched.map((r) => r.decls),
    [inline],
  ];
  for (const important of [false, true]) {
    for (const layer of layers) {
      for (const decls of layer) {
        for (const [prop, d] of decls)
          if (d.important === important) out.set(prop, d.value);
      }
    }
  }
  return out;
}

function optionsFor(html: string): IOptions {
  const rules = classRules(html);
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
        const next = { ...attribs };
        if (
          "hidden" in attribs ||
          hidesByStyle(resolve(tagName, attribs, rules))
        )
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
