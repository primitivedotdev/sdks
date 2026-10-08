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
const PERCENT = new RegExp(`^${NUMBER}%$`);
const BARE_ZERO = /^[+-]?(0+\.?0*|\.0+)$/;
const NUMERIC = /^[+-]?[\d.]/;

/**
 * A browser ignores a declaration whose value is malformed (`height:0foo`),
 * so it is ignored here too. Anything else is kept, including values this
 * code cannot compute (calc(), var(), keywords): those never count as hiding,
 * so an override it cannot evaluate errs towards keeping the content.
 */
function valid(prop: string, value: string): boolean {
  // A function value (var(), calc(), env()) may be valid and cannot be computed here: keep it as unknown.
  if (value.includes("(")) return true;
  if (prop === "display") return validDisplay(value);
  if (prop.startsWith("overflow"))
    return (
      OVERFLOW.test(value) ||
      /^(inherit|initial|unset|revert|revert-layer)$/.test(value)
    );
  if (!NUMERIC.test(value)) return true;
  if (prop === "opacity")
    return BARE_NUMBER.test(value) || new RegExp(`^${NUMBER}%$`).test(value);
  if (prop.endsWith("height"))
    return LENGTH.test(value) || BARE_ZERO.test(value);
  return true;
}

const DISPLAY_SINGLE =
  /^(none|contents|block|inline|run-in|flow|flow-root|table|flex|grid|ruby|list-item|inline-block|inline-table|inline-flex|inline-grid|table-[a-z-]+|ruby-[a-z-]+|inherit|initial|unset|revert|revert-layer)$/;
const OUTER = /^(block|inline|run-in)$/;
const INNER = /^(flow|flow-root|table|flex|grid|ruby)$/;

interface DisplayParts {
  outer?: string;
  inner?: string;
  listItem: boolean;
}

/** Multi-keyword display (CSS Display 3): an outer and/or inner type and list-item, in any order, each at most once. */
function displayParts(value: string): DisplayParts | null {
  const parts: DisplayParts = { listItem: false };
  for (const t of value.split(" ")) {
    if (OUTER.test(t) && !parts.outer) parts.outer = t;
    else if (INNER.test(t) && !parts.inner) parts.inner = t;
    else if (t === "list-item" && !parts.listItem) parts.listItem = true;
    else return null;
  }
  if (parts.listItem && parts.inner && !/^flow(-root)?$/.test(parts.inner))
    return null;
  return parts;
}

const validDisplay = (value: string): boolean =>
  value.includes(" ")
    ? displayParts(value) !== null
    : DISPLAY_SINGLE.test(value);
const OVERFLOW = /^(visible|hidden|clip|scroll|auto|overlay)$/;

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
      .toLowerCase()
      .replace(/[ \t\n\r\f]+/g, " ");
    const important = /!\s*important\s*$/.test(value);
    if (important) value = value.replace(/!\s*important\s*$/, "").trim();
    if (name === "overflow") {
      // Shorthand: one value for both axes (a reset keyword included), or
      // horizontal then vertical. A browser drops any other shape.
      const parts = value.split(/\s+/);
      const ok =
        parts.length === 1
          ? valid("overflow-x", parts[0] ?? "")
          : parts.length === 2 && parts.every((v) => OVERFLOW.test(v));
      if (!ok) continue;
      const [x = "", y = x] = parts;
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

/**
 * Whether the box certainly clips vertically: only an explicit clipping value
 * on the vertical axis counts. CSS can also make the vertical axis clip
 * through the horizontal one or through inheritance; those cases are left
 * alone, which keeps (and may expose) content rather than risk deleting it.
 */
function clipsVertically(d: Map<string, string>): boolean {
  return CLIPS.test(d.get("overflow-y") ?? "");
}

interface Rule {
  tag: string;
  classes: string[];
  specificity: number;
  order: number;
  decls: Map<string, Decl>;
}

/**
 * The target of a rule this code does not evaluate (inside a media query or
 * other @-block, or with a complex selector) that could make an element
 * visible: the tag, id and classes of its rightmost compound selector.
 */
interface Restorer {
  tag: string;
  id: string;
  classes: string[];
  important: boolean;
  /** Which ways of hiding this rule could undo. */
  undoes: Set<Hide>;
}

type Hide = "display" | "opacity" | "clip";

interface Sheet {
  /** Simple class rules, indexed by each class they name. */
  byClass: Map<string, Rule[]>;
  /** Unevaluated rules that could show something, indexed by a class, id or tag they require ("" for none). */
  restorers: Map<string, Restorer[]>;
}

/** Which ways of hiding these declarations could undo, and whether any of those declarations is important. */
function couldShow(decls: Map<string, Decl>): {
  undoes: Set<Hide>;
  important: boolean;
} {
  const undoes = new Set<Hide>();
  let important = false;
  for (const [prop, d] of decls) {
    let undo: Hide | null = null;
    if (prop === "display" && d.value !== "none") {
      undo = "display";
      // An element made inline is no longer a box that height and overflow can clip.
      if (!isClippingBox(d.value)) undoes.add("clip");
    } else if (
      prop === "opacity" &&
      !(BARE_NUMBER.test(d.value) && Number.parseFloat(d.value) === 0)
    )
      undo = "opacity";
    else if (
      (prop === "overflow-y" && !CLIPS.test(d.value)) ||
      (prop.endsWith("height") && !isZero(d.value))
    )
      undo = "clip";
    if (undo) {
      undoes.add(undo);
      important ||= d.important;
    }
  }
  return { undoes, important };
}

function rightmostCompound(selector: string): Restorer | null {
  const last =
    selector
      .trim()
      .split(/[\s>+~]+/)
      .at(-1) ?? "";
  if (!last) return null;
  const tag = last.match(/^([a-z][a-z0-9-]*|\*)/i)?.[1]?.toLowerCase() ?? "";
  const id = last.match(/#([\w-]+)/)?.[1] ?? "";
  const classes = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1] ?? "");
  return {
    tag: tag === "*" ? "" : tag,
    id,
    classes,
    important: false,
    undoes: new Set(),
  };
}

function readSheet(html: string): Sheet {
  const byClass = new Map<string, Rule[]>();
  const restorers = new Map<string, Restorer[]>();
  let order = 0;
  const addRestorers = (selectors: string, decls: Map<string, Decl>) => {
    const { undoes, important } = couldShow(decls);
    if (!undoes.size) return;
    for (const sel of selectors.split(",")) {
      const r = rightmostCompound(sel);
      if (!r) continue;
      const key = r.classes[0] ? `.${r.classes[0]}` : r.id ? `#${r.id}` : r.tag;
      const list = restorers.get(key);
      const entry = { ...r, important, undoes };
      if (list) list.push(entry);
      else restorers.set(key, [entry]);
    }
  };
  const sheets = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  for (const sheet of sheets) {
    const css = stripComments(
      sheet.replace(/^<style\b[^>]*>|<\/style>$/gi, ""),
    );
    // Rules nested in @-blocks apply only to some readers, so they can only ever make the outcome uncertain.
    for (const block of atBlocks(css)) {
      for (const m of block.matchAll(/([^{}@]+)\{([^{}]*)\}/g))
        addRestorers(m[1] ?? "", declarations(m[2] ?? ""));
    }
    for (const m of removeAtBlocks(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decls = declarations(m[2] ?? "");
      if (!decls.size) continue;
      for (const sel of (m[1] ?? "").split(",")) {
        const simple = sel.trim().match(/^([a-z][a-z0-9]*)?((?:\.[\w-]+)+)$/i);
        if (!simple) {
          addRestorers(sel, decls);
          continue;
        }
        const classes = (simple[2] ?? "").split(".").filter(Boolean);
        const rule: Rule = {
          tag: (simple[1] ?? "").toLowerCase(),
          classes,
          specificity: classes.length * 1000 + (simple[1] ? 1 : 0),
          order: order++,
          decls,
        };
        for (const c of classes) {
          const list = byClass.get(c);
          if (list) list.push(rule);
          else byClass.set(c, [rule]);
        }
      }
    }
  }
  return { byClass, restorers };
}

function atBlocks(css: string): string[] {
  const out: string[] = [];
  for (let at = css.search(/@[a-z-]+[^{;]*\{/i); at >= 0; ) {
    let depth = 0;
    let end = css.indexOf("{", at);
    const start = end + 1;
    for (; end < css.length; end++) {
      if (css[end] === "{") depth++;
      else if (css[end] === "}" && --depth === 0) break;
    }
    out.push(css.slice(start, end));
    const next = css.slice(end + 1).search(/@[a-z-]+[^{;]*\{/i);
    at = next < 0 ? -1 : end + 1 + next;
  }
  return out;
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

/** Whether a rule this code does not evaluate might target the element and show it. */
/** Every way the resolved declarations hide the element; each one alone is enough to hide it. */
function hideReasons(d: Map<string, string>, boxClips: boolean): Set<Hide> {
  const out = new Set<Hide>();
  if (d.get("display") === "none") out.add("display");
  const opacity = d.get("opacity");
  if (
    opacity !== undefined &&
    (BARE_NUMBER.test(opacity) || PERCENT.test(opacity)) &&
    Number.parseFloat(opacity) === 0
  )
    out.add("opacity");
  if (boxClips && clipsVertically(d)) {
    const minHeight = d.get("min-height");
    const keepsHeight = minHeight && !isZero(minHeight) && minHeight !== "auto";
    if (
      !keepsHeight &&
      ["max-height", "height"].some((p) => isZero(d.get(p) ?? "x"))
    )
      out.add("clip");
  }
  return out;
}

/**
 * Whether rules this code does not evaluate might show the element. Every way
 * it is hidden has to be undoable by some rule that might target it, since any
 * one of them alone keeps it hidden. A hide set by the inline style can only
 * be undone by an important rule.
 */
function mayBeRestored(
  tagName: string,
  attribs: Record<string, string>,
  own: Set<string>,
  restorers: Map<string, Restorer[]>,
  reasons: Set<Hide>,
  inlineReasons: Set<Hide>,
): boolean {
  const tag = tagName.toLowerCase();
  const keys = [
    "",
    tag,
    ...(attribs.id ? [`#${attribs.id}`] : []),
    ...[...own].map((c) => `.${c}`),
  ];
  const undoable = (why: Hide) =>
    keys.some((k) =>
      (restorers.get(k) ?? []).some(
        (r) =>
          r.undoes.has(why) &&
          (!inlineReasons.has(why) || r.important) &&
          (!r.id || r.id === attribs.id) &&
          (!r.tag || r.tag === tag) &&
          r.classes.every((c) => own.has(c)),
      ),
    );
  return [...reasons].every(undoable);
}

/** The winning value of each relevant property for one element. */
function resolve(
  tagName: string,
  attribs: Record<string, string>,
  sheet: Sheet,
  own: Set<string>,
): Map<string, string> {
  const seen = new Set<Rule>();
  const matched: Rule[] = [];
  for (const c of own) {
    for (const r of sheet.byClass.get(c) ?? []) {
      if (seen.has(r)) continue;
      seen.add(r);
      if (
        (!r.tag || r.tag === tagName.toLowerCase()) &&
        r.classes.every((x) => own.has(x))
      )
        matched.push(r);
    }
  }
  matched.sort((x, y) => x.specificity - y.specificity || x.order - y.order);
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

// Block-level by default. height and overflow do not clip an inline box.
const BLOCK_TAGS = new Set([
  "div",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "center",
  "blockquote",
  "pre",
  "address",
  "dl",
  "dt",
  "dd",
]);
// One-keyword forms, and two-keyword forms whose outer type is block or whose inner type makes an inline box a block container.
const BLOCK_SINGLE =
  /^(block|inline-block|flow-root|flex|inline-flex|grid|inline-grid|list-item)$/;

/** Whether a display value makes a box that height and overflow can clip (not inline, table or ruby). */
function isClippingBox(value: string): boolean {
  if (!value.includes(" ")) return BLOCK_SINGLE.test(value);
  const p = displayParts(value);
  if (!p) return false;
  const outer = p.outer ?? "block";
  const inner = p.inner ?? "flow";
  if (/^(table|ruby)$/.test(inner)) return false;
  return outer !== "inline" || inner !== "flow";
}

function hiddenElement(
  tagName: string,
  attribs: Record<string, string>,
  sheet: Sheet,
): boolean {
  if ("hidden" in attribs) return true;
  const own = new Set((attribs.class ?? "").split(/\s+/).filter(Boolean));
  if (!attribs.style && own.size === 0) return false;
  const d = resolve(tagName, attribs, sheet, own);
  const display = d.get("display");
  const boxClips = display
    ? isClippingBox(display)
    : BLOCK_TAGS.has(tagName.toLowerCase());
  const reasons = hideReasons(d, boxClips);
  if (!reasons.size) return false;
  const inline = new Map(
    [...declarations(attribs.style ?? "")].map(([k, v]) => [k, v.value]),
  );
  return !mayBeRestored(
    tagName,
    attribs,
    own,
    sheet.restorers,
    reasons,
    hideReasons(inline, boxClips),
  );
}

function optionsFor(html: string): IOptions {
  const sheet = readSheet(html);
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
        if (hiddenElement(tagName, attribs, sheet)) hiddenElements.add(next);
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
