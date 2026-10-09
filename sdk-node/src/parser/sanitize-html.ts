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

// Every scan of sender-controlled text below is linear in its length. This
// runs on each inbound message before it is stored, so a pattern that
// backtracks (a regex with overlapping quantifiers, or a lazy search retried
// from every start position) lets one crafted message hold the parser for
// seconds. CSS is scanned by hand for that reason; the remaining regexes are
// anchored keyword lists or single character classes.

/**
 * Where a CSS number (`[+-]?(\d+\.?\d*|\.\d+)`) at the start of `v` ends,
 * or -1 if `v` does not start with one. A unit or `%` never contains a digit
 * or a dot, so the number is the whole run of digits and dots after the sign.
 */
function numberEnd(v: string): number {
  let i = v[0] === "+" || v[0] === "-" ? 1 : 0;
  let digits = 0;
  let dots = 0;
  for (; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c >= 48 && c <= 57) digits++;
    else if (c === 46) dots++;
    else break;
  }
  return digits > 0 && dots <= 1 ? i : -1;
}

const UNITS = new Set([
  "px",
  "pt",
  "pc",
  "in",
  "cm",
  "mm",
  "q",
  "em",
  "rem",
  "ex",
  "ch",
  "vw",
  "vh",
  "vmin",
  "vmax",
  "%",
]);

/** A number followed by a length unit or `%`. */
function isLength(v: string): boolean {
  const end = numberEnd(v);
  return end >= 0 && UNITS.has(v.slice(end));
}

const isBareNumber = (v: string): boolean =>
  v.length > 0 && numberEnd(v) === v.length;

function isPercent(v: string): boolean {
  const end = numberEnd(v);
  return end >= 0 && end === v.length - 1 && v[end] === "%";
}

/** A number written with zeros only (`0`, `-0.0`, `.00`). */
function isBareZero(v: string): boolean {
  if (!isBareNumber(v)) return false;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c !== "0" && c !== "." && c !== "+" && c !== "-") return false;
  }
  return true;
}

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
  if (prop === "opacity") return isBareNumber(value) || isPercent(value);
  if (prop.endsWith("height")) return isLength(value) || isBareZero(value);
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

/**
 * Replaces each comment with a space. An unclosed comment is left as text:
 * once one has no end, no later one has either, so the scan stops there.
 */
function stripComments(css: string): string {
  let out = "";
  let from = 0;
  for (;;) {
    const open = css.indexOf("/*", from);
    if (open < 0) break;
    const close = css.indexOf("*/", open + 2);
    if (close < 0) break;
    out += `${css.slice(from, open)} `;
    from = close + 2;
  }
  return out + css.slice(from);
}

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
  isBareZero(v) || (isLength(v) && isBareZero(v.slice(0, numberEnd(v))));
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

/** A declaration's position in the stylesheet and its value. */
/** A stylesheet declaration's rank in the cascade, and its value. */
interface Ranked {
  specificity: number;
  order: number;
  value: string;
}

const outranks = (a: Ranked, b: Ranked | undefined): boolean =>
  !b ||
  a.specificity > b.specificity ||
  (a.specificity === b.specificity && a.order > b.order);

/**
 * The simple class rules that match exactly the same elements: the same tag
 * and the same set of classes (`.a`, `.a.a` and `p.a` match alike only in
 * the first two). They match together, so only the highest-ranked normal and
 * important declaration of each property among them can ever win, and any
 * number of such rules is one entry.
 */
interface RuleGroup {
  tag: string;
  /** Distinct classes, each of which the element must have. */
  classes: string[];
  normal: Map<string, Ranked>;
  important: Map<string, Ranked>;
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
  /** Simple class rules grouped by what they match, each group indexed by one class (`.c`) or tag it requires. */
  groups: Map<string, RuleGroup[]>;
  /** Every class some group requires; other classes cannot change what matches. */
  groupClasses: Set<string>;
  /** Stylesheet winners already worked out, by tag and the element's classes in groupClasses. */
  matched: Map<string, SheetWins>;
  /** Cascade work this message may still spend; see CASCADE_BUDGET_PER_CHAR. */
  budget: CascadeBudget;
  /** Distinct unevaluated rules that could show something, each indexed by one class, id or tag it requires ("" for none). */
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
      !(isBareNumber(d.value) && Number.parseFloat(d.value) === 0)
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

const SIMPLE_SELECTOR = /^([a-z][a-z0-9]*)?((?:\.[\w-]+)+)$/i;

/**
 * Weighing the cascade for an element costs one unit per stylesheet rule
 * group or restorer it has to check, plus one per class that check compares.
 * Grouping, indexing and per-signature reuse keep that small for real mail,
 * but an element can genuinely match very many rules (many classes, and a
 * stylesheet with a rule for many subsets of them), and elements alike in
 * nothing else each pay again. So each message gets a budget linear in its
 * size, and an element whose evaluation would run past it is treated as
 * hidden: when the sanitizer cannot tell whether content was meant to be
 * seen, it drops it rather than pass on what may be hidden text. Every such
 * element is counted in the report so the caller can alert on it.
 *
 * The figures are measured, not guessed. Over the real email fixtures in the
 * tests (Gmail, Outlook, Apple Mail, Yahoo and Thunderbird mail, and five
 * newsletter template sets) no message spent more than 8 units. Over about
 * 209,000 seeded random and mutated documents, built to be dense in class
 * rules and classed elements, the most any message spent was 213 units, and
 * the most any message over 2 KB spent per character of HTML was 0.081. The
 * budget is 50,000 units (about 230 times the first) plus 3 per character
 * (about 37 times the second), and a test holds every one of those inputs to
 * zero refusals. A crafted 1 MB message is held to about 3 million units,
 * which takes well under 100 ms.
 */
const CASCADE_BUDGET_PER_CHAR = 3;
const CASCADE_BUDGET_BASE = 50_000;

interface CascadeBudget {
  /** Units still available; negative once spent out. */
  left: number;
  /** Units spent. */
  spent: number;
  /** Elements treated as hidden because their evaluation ran out of budget. */
  exhausted: number;
}

/** Charges `units` of cascade work; false once the message's budget is spent. */
function spend(budget: CascadeBudget, units: number): boolean {
  budget.spent += units;
  budget.left -= units;
  return budget.left >= 0;
}

function readSheet(html: string): Sheet {
  const groups = new Map<string, RuleGroup>();
  const restorers = new Map<string, Restorer>();
  let order = 0;
  const addRestorers = (selectors: string, decls: Map<string, Decl>) => {
    const { undoes, important } = couldShow(decls);
    if (!undoes.size) return;
    for (const sel of selectors.split(",")) {
      const r = rightmostCompound(sel);
      if (!r) continue;
      // Two rules with the same target and effect decide the same elements.
      const key = [
        r.tag,
        r.id,
        [...new Set(r.classes)].sort().join("."),
        important,
        [...undoes].sort().join(),
      ].join("|");
      if (!restorers.has(key))
        restorers.set(key, {
          ...r,
          classes: [...new Set(r.classes)],
          important,
          undoes,
        });
    }
  };
  for (const sheet of styleSheets(html)) {
    const css = stripComments(sheet);
    // Rules nested in @-blocks apply only to some readers, so they can only ever make the outcome uncertain.
    for (const block of atBlocks(css)) {
      for (const [selectors, body] of cssRules(block, true))
        addRestorers(selectors, declarations(body));
    }
    for (const [selectors, body] of cssRules(removeAtBlocks(css), false)) {
      const decls = declarations(body);
      if (!decls.size) continue;
      for (const sel of selectors.split(",")) {
        const simple = sel.trim().match(SIMPLE_SELECTOR);
        if (!simple) {
          addRestorers(sel, decls);
          continue;
        }
        const classes = (simple[2] ?? "").split(".").filter(Boolean);
        const tag = (simple[1] ?? "").toLowerCase();
        const distinct = [...new Set(classes)].sort();
        const key = `${tag}|${distinct.join(".")}`;
        let group = groups.get(key);
        if (!group) {
          group = {
            tag,
            classes: distinct,
            normal: new Map(),
            important: new Map(),
          };
          groups.set(key, group);
        }
        const specificity = classes.length * 1000 + (simple[1] ? 1 : 0);
        const ranked = order++;
        for (const [prop, d] of decls) {
          const layer = d.important ? group.important : group.normal;
          const entry = { specificity, order: ranked, value: d.value };
          if (outranks(entry, layer.get(prop))) layer.set(prop, entry);
        }
      }
    }
  }
  return {
    groupClasses: new Set([...groups.values()].flatMap((g) => g.classes)),
    matched: new Map(),
    budget: {
      left: CASCADE_BUDGET_BASE + CASCADE_BUDGET_PER_CHAR * html.length,
      spent: 0,
      exhausted: 0,
    },
    groups: indexByRarestKey([...groups.values()], (g) => [
      ...g.classes.map((c) => `.${c}`),
      ...(g.tag ? [g.tag] : []),
    ]),
    restorers: indexByRarestKey([...restorers.values()], (r) => {
      const keys = [
        ...r.classes.map((c) => `.${c}`),
        ...(r.id ? [`#${r.id}`] : []),
        ...(r.tag ? [r.tag] : []),
      ];
      return keys.length ? keys : [""];
    }),
  };
}

/**
 * Indexes each entry under one of its keys, the one the fewest entries share.
 * An element looks entries up by every key it has, and an entry applies only
 * to an element that has all of its keys, so any one of them finds it. The
 * rarest one spares an element from scanning entries that need some other
 * class or tag it lacks: without it, many rules on `.a.x1`, `.a.x2`, ... or
 * `x1.a`, `x2.a`, ... would each be checked against every element of class
 * `a`. What is left is the cost of the rules an element actually matches,
 * which the cascade has to weigh; elements alike in tag and classes share
 * that work (see sheetWins).
 */
function indexByRarestKey<T>(
  entries: T[],
  keysOf: (entry: T) => string[],
): Map<string, T[]> {
  const shared = new Map<string, number>();
  for (const e of entries)
    for (const k of new Set(keysOf(e))) shared.set(k, (shared.get(k) ?? 0) + 1);
  const index = new Map<string, T[]>();
  for (const e of entries) {
    let key = "";
    let fewest = Number.POSITIVE_INFINITY;
    for (const k of keysOf(e)) {
      const n = shared.get(k) ?? 0;
      if (n < fewest) {
        key = k;
        fewest = n;
      }
    }
    const list = index.get(key);
    if (list) list.push(e);
    else index.set(key, [e]);
  }
  return index;
}

/**
 * The contents of each `<style>` element, as the case-insensitive pattern
 * `<style\b[^>]*>[\s\S]*?<\/style>` would find them. Once an opening tag has
 * no `>` or no closing tag after it, neither does any later one, so the scan
 * stops there instead of retrying from each later `<style`.
 */
function styleSheets(html: string): string[] {
  const out: string[] = [];
  const open = /<style\b/gi;
  const close = /<\/style>/gi;
  for (let tag = open.exec(html); tag; tag = open.exec(html)) {
    const body = html.indexOf(">", tag.index + 6);
    if (body < 0) break;
    close.lastIndex = body + 1;
    const end = close.exec(html);
    if (!end) break;
    out.push(html.slice(body + 1, end.index));
    open.lastIndex = end.index + 8;
  }
  return out;
}

/**
 * Each `selectors{declarations}` pair with no brace inside either part (and
 * no `@` in the selectors when `noAt`), as `/([^{}]+)\{([^{}]*)\}/g` would
 * find them. A start that fails, fails for every position up to the brace
 * that stopped it, so the scan resumes after that brace and reads each
 * character at most twice.
 */
function cssRules(css: string, noAt: boolean): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let start = 0; start < css.length; ) {
    let open = start;
    while (
      open < css.length &&
      css[open] !== "{" &&
      css[open] !== "}" &&
      !(noAt && css[open] === "@")
    )
      open++;
    if (open === css.length) break;
    if (css[open] !== "{" || open === start) {
      start = open + 1;
      continue;
    }
    let close = open + 1;
    while (close < css.length && css[close] !== "{" && css[close] !== "}")
      close++;
    if (css[close] !== "}") {
      start = open + 1;
      continue;
    }
    out.push([css.slice(start, open), css.slice(open + 1, close)]);
    start = close + 1;
  }
  return out;
}

const isAtNameChar = (c: number): boolean =>
  (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 45;

/** For each index, the first `{` or `;` at or after it (css.length if none). */
function stops(css: string): Int32Array {
  const next = new Int32Array(css.length + 1);
  next[css.length] = css.length;
  for (let i = css.length - 1; i >= 0; i--)
    next[i] =
      css[i] === "{" || css[i] === ";" ? i : (next[i + 1] ?? css.length);
  return next;
}

/**
 * Where the block opens of an @-rule whose name starts at `name` (just after
 * the `@`), or -1 if none does: the name is a letter or dash, and the first
 * `{` or `;` after it is a `{`. This is the shape `/@[a-z-]+[^{;]*\{/i`
 * matches, answered from `next` without rescanning.
 */
function blockOpen(css: string, next: Int32Array, name: number): number {
  if (name >= css.length || !isAtNameChar(css.charCodeAt(name))) return -1;
  const open = next[name] ?? css.length;
  return css[open] === "{" ? open : -1;
}

/** The first @-rule with a block at or after `from`. */
function firstAtBlock(
  css: string,
  next: Int32Array,
  from: number,
): { at: number; open: number } | null {
  for (
    let at = css.indexOf("@", from);
    at >= 0;
    at = css.indexOf("@", at + 1)
  ) {
    const open = blockOpen(css, next, at + 1);
    if (open >= 0) return { at, open };
  }
  return null;
}

/** The index of the brace that closes the block opened at `open`, or css.length if it never closes. */
function blockEnd(css: string, open: number): number {
  let depth = 0;
  let end = open;
  for (; end < css.length; end++) {
    if (css[end] === "{") depth++;
    else if (css[end] === "}" && --depth === 0) break;
  }
  return end;
}

/** The contents of each top-level @-rule block. */
function atBlocks(css: string): string[] {
  const out: string[] = [];
  const next = stops(css);
  for (let found = firstAtBlock(css, next, 0); found; ) {
    const end = blockEnd(css, found.open);
    out.push(css.slice(found.open + 1, end));
    found = firstAtBlock(css, next, end + 1);
  }
  return out;
}

/**
 * The stylesheet with each @-rule block cut out, as repeatedly cutting the
 * first one and searching again from the start would leave it. Text before a
 * cut held no @-rule before the cut and still holds none, except that an `@`
 * just before the cut can now meet a name just after it, so the search
 * resumes at the cut rather than from the start.
 */
function removeAtBlocks(css: string): string {
  const next = stops(css);
  // Kept ranges of css, in order, none empty; then everything from `rest` on.
  const kept: Array<[number, number]> = [];
  let rest = 0;
  for (;;) {
    const last = kept.at(-1);
    let open =
      last && css[last[1] - 1] === "@" ? blockOpen(css, next, rest) : -1;
    if (last && open >= 0) {
      last[1]--;
      if (last[0] === last[1]) kept.pop();
    } else {
      const found = firstAtBlock(css, next, rest);
      if (!found) break;
      if (found.at > rest) kept.push([rest, found.at]);
      open = found.open;
    }
    rest = Math.min(blockEnd(css, open) + 1, css.length);
  }
  return kept.map(([a, b]) => css.slice(a, b)).join("") + css.slice(rest);
}

/** Every way the resolved declarations hide the element; each one alone is enough to hide it. */
function hideReasons(d: Map<string, string>, boxClips: boolean): Set<Hide> {
  const out = new Set<Hide>();
  if (d.get("display") === "none") out.add("display");
  const opacity = d.get("opacity");
  if (
    opacity !== undefined &&
    (isBareNumber(opacity) || isPercent(opacity)) &&
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
  sheet: Sheet,
  reasons: Set<Hide>,
  inlineReasons: Set<Hide>,
): boolean | null {
  const tag = tagName.toLowerCase();
  const keys = [
    "",
    tag,
    ...(attribs.id ? [`#${attribs.id}`] : []),
    ...[...own].map((c) => `.${c}`),
  ];
  for (const why of reasons) {
    let undone = false;
    for (const k of keys) {
      for (const r of sheet.restorers.get(k) ?? []) {
        if (!spend(sheet.budget, 1 + r.classes.length)) return null;
        if (
          r.undoes.has(why) &&
          (!inlineReasons.has(why) || r.important) &&
          (!r.id || r.id === attribs.id) &&
          (!r.tag || r.tag === tag) &&
          r.classes.every((c) => own.has(c))
        ) {
          undone = true;
          break;
        }
      }
      if (undone) break;
    }
    if (!undone) return false;
  }
  return true;
}

/** Per property, the stylesheet declaration that wins at each importance. */
interface SheetWins {
  normal: Map<string, Ranked>;
  important: Map<string, Ranked>;
}

/**
 * The stylesheet's winning declarations for an element. They depend only on
 * its tag and on which of the classes that groups require it has, so elements
 * alike in those share one lookup.
 */
function sheetWins(
  tag: string,
  own: Set<string>,
  sheet: Sheet,
): SheetWins | null {
  const relevant = [...own].filter((c) => sheet.groupClasses.has(c)).sort();
  const key = `${tag} ${relevant.join(" ")}`;
  const known = sheet.matched.get(key);
  if (known) return known;
  const wins: SheetWins = { normal: new Map(), important: new Map() };
  const take = (into: Map<string, Ranked>, decls: Map<string, Ranked>) => {
    for (const [prop, d] of decls)
      if (outranks(d, into.get(prop))) into.set(prop, d);
  };
  for (const k of [tag, ...relevant.map((c) => `.${c}`)]) {
    for (const g of sheet.groups.get(k) ?? []) {
      // Out of budget: nothing is remembered, so a later element alike in tag and classes is refused too.
      if (!spend(sheet.budget, 1 + g.classes.length)) return null;
      if ((!g.tag || g.tag === tag) && g.classes.every((c) => own.has(c))) {
        take(wins.normal, g.normal);
        take(wins.important, g.important);
      }
    }
  }
  sheet.matched.set(key, wins);
  return wins;
}

/** The winning value of each relevant property for one element. */
function resolve(
  tagName: string,
  attribs: Record<string, string>,
  sheet: Sheet,
  own: Set<string>,
): Map<string, string> | null {
  const wins = sheetWins(tagName.toLowerCase(), own, sheet);
  if (!wins) return null;
  const { normal, important } = wins;
  const inline = declarations(attribs.style ?? "");
  const out = new Map<string, string>();
  // Cascade order, highest first: important inline, important stylesheet, normal inline, normal stylesheet.
  for (const prop of RELEVANT) {
    const set = inline.get(prop);
    const value =
      (set?.important ? set.value : undefined) ??
      important.get(prop)?.value ??
      (set && !set.important ? set.value : undefined) ??
      normal.get(prop)?.value;
    if (value !== undefined) out.set(prop, value);
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
  if (!d) return outOfBudget(sheet);
  const display = d.get("display");
  const boxClips = display
    ? isClippingBox(display)
    : BLOCK_TAGS.has(tagName.toLowerCase());
  const reasons = hideReasons(d, boxClips);
  if (!reasons.size) return false;
  const inline = new Map(
    [...declarations(attribs.style ?? "")].map(([k, v]) => [k, v.value]),
  );
  const restored = mayBeRestored(
    tagName,
    attribs,
    own,
    sheet,
    reasons,
    hideReasons(inline, boxClips),
  );
  return restored === null ? outOfBudget(sheet) : !restored;
}

/** An element whose evaluation ran out of budget is hidden (see CASCADE_BUDGET_PER_CHAR). */
function outOfBudget(sheet: Sheet): true {
  sheet.budget.exhausted++;
  return true;
}

function optionsFor(sheet: Sheet): IOptions {
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

/** What sanitizing one HTML body cost, and whether any of it was refused. */
export interface SanitizeHtmlReport {
  /**
   * Elements dropped because weighing the stylesheet for them would have run
   * past the message's cascade budget. Zero for real mail; anything else means
   * a message built to be expensive, and the caller should count it.
   */
  cascadeBudgetExceeded: number;
  /** Cascade work spent, in the units the budget is counted in. */
  cascadeWork: number;
  /** The cascade budget this body was given. */
  cascadeBudget: number;
}

export function sanitizeHtml(html: string): string {
  return sanitizeHtmlWithReport(html).html;
}

/** sanitizeHtml, plus a report of the cascade work it took. */
export function sanitizeHtmlWithReport(html: string): {
  html: string;
  report: SanitizeHtmlReport;
} {
  const sheet = readSheet(html);
  const total = sheet.budget.left;
  const out = sanitizeHtmlLib(html, optionsFor(sheet));
  return {
    html: out,
    report: {
      cascadeBudgetExceeded: sheet.budget.exhausted,
      cascadeWork: sheet.budget.spent,
      cascadeBudget: total,
    },
  };
}

/**
 * The scanning steps, exposed only so tests can compare each one with the
 * regex it replaced. Not part of the package API.
 */
export const internalScans = {
  styleSheets,
  stripComments,
  atBlocks,
  removeAtBlocks,
  cssRules,
  isLength,
  isBareNumber,
  isPercent,
  isBareZero,
  isZero,
};
