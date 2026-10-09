import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseEmailWithAttachments } from "../../src/parser/attachment-parser.js";
import {
  internalScans,
  sanitizeHtml,
  sanitizeHtmlWithReport,
} from "../../src/parser/sanitize-html.js";
import {
  sanitizeHtml as referenceSanitizeHtml,
  referenceScans,
} from "./sanitize-html.reference.js";

// The stylesheet and number scans in the sanitizer replace regexes that
// backtracked on crafted input. These tests hold the replacements to exactly
// the output of the original implementation (kept in
// sanitize-html.reference.ts), on real email HTML and on seeded random input,
// and hold each known worst case to a linear-time budget.

const FIXTURES = join(import.meta.dirname, "fixtures", "html");
const fixtures = readdirSync(FIXTURES)
  .filter((f) => f.endsWith(".html"))
  .map((f) => ({ name: f, html: readFileSync(join(FIXTURES, f), "utf8") }));

/** Deterministic PRNG so a failure reproduces from its seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T>(r: Rand, xs: readonly T[]): T =>
  xs[Math.floor(r() * xs.length)] as T;
const many = (r: Rand, max: number, gen: () => string): string =>
  Array.from({ length: Math.floor(r() * (max + 1)) }, gen).join("");

const CSS_TOKENS = [
  "@",
  "@media x",
  "@media screen and (max-width:480px)",
  "@-x",
  "@font-face",
  "@page",
  "@A",
  "@@",
  "{",
  "}",
  ";",
  "/*",
  "*/",
  "/",
  "*",
  ".a",
  ".b",
  ".a.b",
  "#i",
  "div",
  "p",
  " ",
  "\n",
  ",",
  ">",
  ":",
  "display:none",
  "display:block",
  "display: inline block",
  "opacity:0",
  "opacity:0%",
  "height:0",
  "max-height:0px",
  "min-height:1px",
  "overflow:hidden",
  "overflow-y:auto",
  "!important",
  "! important",
  "a",
  "-",
  "<style>",
  "</style>",
  "<STYLE type=x>",
  "<style",
  "</STYLE>",
  "<styles>",
  "<!--",
  "-->",
  "0",
  ".",
  "1px",
  "%",
];

const randomCss = (r: Rand, max = 40): string =>
  many(r, max, () => pick(r, CSS_TOKENS));

const NUMBER_TOKENS = [
  "+",
  "-",
  "0",
  "00",
  "1",
  "9",
  ".",
  "px",
  "%",
  "p",
  "x",
  "em",
  "vmin",
  "q",
  "e",
  " ",
  "a",
  "PX",
];

const SELECTORS = [
  ".a",
  ".b",
  ".c",
  ".A",
  "div.a",
  "p.b",
  "td.c",
  ".a.b",
  ".b.a.c",
  ".a.a",
  ".a.a.b",
  "p.a.a",
  "b.a",
  "span.c.a",
  "p .a",
  ".a > .b",
  "#i",
  "#j.a",
  "*",
  "div",
  "span",
  "[hidden]",
  "a:hover",
];
const DECLARATIONS = [
  "display:none",
  "display:block",
  "display:inline",
  "display:flex",
  "display:inline flow-root",
  "display:none!important",
  "display:block !important",
  "display:bogus",
  "opacity:0",
  "opacity:0.0",
  "opacity:0%",
  "opacity:1",
  "opacity:.5 !important",
  "height:0",
  "height:0px",
  "height:-0.0em",
  "height:0foo",
  "height:calc(0px)",
  "max-height:0",
  "min-height:0",
  "min-height:10px",
  "min-height:auto",
  "overflow:hidden",
  "overflow:hidden visible",
  "overflow:auto auto",
  "overflow-y:clip",
  "overflow-y:visible",
  "color:red",
  "",
];
const TAGS = [
  "div",
  "p",
  "span",
  "b",
  "td",
  "li",
  "a",
  "center",
  "font",
  "img",
  "table",
];

function randomRule(r: Rand): string {
  const selectors = Array.from({ length: 1 + Math.floor(r() * 3) }, () =>
    pick(r, SELECTORS),
  ).join(r() < 0.5 ? "," : ", ");
  const decls = Array.from({ length: 1 + Math.floor(r() * 3) }, () =>
    pick(r, DECLARATIONS),
  ).join(";");
  const rule = `${selectors}{${decls}}`;
  const roll = r();
  if (roll < 0.15) return `@media screen{${rule}}`;
  if (roll < 0.2) return `/* ${rule} */`;
  if (roll < 0.25) return rule.slice(0, Math.floor(r() * rule.length));
  if (roll < 0.35) return randomCss(r, 6);
  return rule;
}

function randomElement(r: Rand, depth: number): string {
  const tag = pick(r, TAGS);
  const attrs: string[] = [];
  if (r() < 0.6)
    attrs.push(
      `class="${pick(r, ["a", "b", "c", "a b", "b c", "a c", "A", "a b c"])}"`,
    );
  if (r() < 0.15) attrs.push(`id="${pick(r, ["i", "j"])}"`);
  if (r() < 0.4)
    attrs.push(
      `style="${Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(r, DECLARATIONS)).join(";")}"`,
    );
  if (r() < 0.05) attrs.push("hidden");
  const open = `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
  const inner =
    depth > 0 && r() < 0.5
      ? many(r, 3, () => randomElement(r, depth - 1))
      : pick(r, ["text", "x", "keep me", ""]);
  return r() < 0.1 ? open + inner : `${open}${inner}</${tag}>`;
}

function randomDocument(r: Rand): string {
  const sheets = many(r, 2, () => {
    const css = many(r, 6, () => randomRule(r));
    return r() < 0.1
      ? `<style>${css}`
      : `<style type="text/css">${css}</style>`;
  });
  return sheets + many(r, 6, () => randomElement(r, 3));
}

describe("sanitizeHtml matches the original implementation", () => {
  // Every input here must stay inside the cascade budget: the budget was
  // chosen so real mail never meets it, and an input that did would be
  // sanitized differently from the reference by design.
  const budgetHits = (html: string): number =>
    sanitizeHtmlWithReport(html).report.cascadeBudgetExceeded;

  test.each(fixtures)("real email HTML: $name", ({ html }) => {
    expect(budgetHits(html)).toBe(0);
    expect(sanitizeHtml(html)).toBe(referenceSanitizeHtml(html));
  });

  test("fixtures cover hidden content, @-blocks and comments", () => {
    const all = fixtures.map((f) => f.html).join("\n");
    expect(all).toMatch(/@media/);
    expect(all).toMatch(/@font-face/);
    expect(all).toMatch(/display:\s*none/);
    expect(all).toMatch(/\/\*/);
    expect(fixtures.length).toBeGreaterThanOrEqual(15);
  });

  test("mutated real email HTML (seeded)", () => {
    let mismatches = 0;
    let checked = 0;
    let hits = 0;
    for (const { name, html } of fixtures) {
      const r = mulberry32(name.length * 7919 + html.length);
      for (let i = 0; i < 40; i++) {
        const at = Math.floor(r() * html.length);
        const len = Math.floor(r() * 400);
        const roll = r();
        const mutated =
          roll < 0.3
            ? html.slice(0, at) + html.slice(at + len)
            : roll < 0.6
              ? html.slice(0, at) + randomCss(r, 8) + html.slice(at)
              : roll < 0.8
                ? html.slice(0, at)
                : html.slice(0, at) + html.slice(at, at + len) + html.slice(at);
        checked++;
        hits += budgetHits(mutated);
        if (sanitizeHtml(mutated) !== referenceSanitizeHtml(mutated))
          mismatches++;
      }
    }
    expect(checked).toBe(fixtures.length * 40);
    expect(mismatches).toBe(0);
    expect(hits).toBe(0);
  });

  test("random documents with stylesheets and styled elements (seeded)", () => {
    const r = mulberry32(20261008);
    const failures: string[] = [];
    let hits = 0;
    for (let i = 0; i < 4000; i++) {
      const html = randomDocument(r);
      hits += budgetHits(html);
      if (sanitizeHtml(html) !== referenceSanitizeHtml(html))
        failures.push(html);
    }
    expect(failures.slice(0, 3)).toEqual([]);
    expect(hits).toBe(0);
  });

  test("random CSS-heavy text (seeded)", () => {
    const r = mulberry32(7467);
    const failures: string[] = [];
    let hits = 0;
    for (let i = 0; i < 4000; i++) {
      const html = `${randomCss(r, 60)}<p class="a b" id="i" style="${randomCss(r, 4)}">x</p><div class=c>y</div>`;
      hits += budgetHits(html);
      if (sanitizeHtml(html) !== referenceSanitizeHtml(html))
        failures.push(html);
    }
    expect(failures.slice(0, 3)).toEqual([]);
    expect(hits).toBe(0);
  });
});

describe("each scan matches the regex it replaced", () => {
  const css = (seed: number, n: number): string[] => {
    const r = mulberry32(seed);
    return Array.from({ length: n }, () => randomCss(r));
  };

  test("style element contents", () => {
    for (const html of css(1, 5000))
      expect(internalScans.styleSheets(html)).toEqual(
        referenceScans.styleSheets(html),
      );
  });

  test("comment stripping", () => {
    for (const text of css(2, 5000))
      expect(internalScans.stripComments(text)).toBe(
        referenceScans.stripComments(text),
      );
  });

  test("@-block contents and removal", () => {
    for (const text of css(3, 8000)) {
      expect(internalScans.atBlocks(text)).toEqual(
        referenceScans.atBlocks(text),
      );
      expect(internalScans.removeAtBlocks(text)).toBe(
        referenceScans.removeAtBlocks(text),
      );
    }
  });

  test("an @ left before a cut block can start the next one", () => {
    for (const text of [
      "@@a{}b{}",
      "x@@@a{}{}c{}d",
      "@@a{}-{};",
      "@@a{b{}}c{d}e",
      "@@a{",
      "@a{}@",
    ]) {
      expect(internalScans.removeAtBlocks(text)).toBe(
        referenceScans.removeAtBlocks(text),
      );
    }
  });

  test("rule extraction", () => {
    for (const text of css(4, 5000)) {
      for (const noAt of [false, true])
        expect(internalScans.cssRules(text, noAt)).toEqual(
          referenceScans.cssRules(text, noAt),
        );
    }
  });

  test("number and length values", () => {
    const r = mulberry32(5);
    const values = new Set<string>(["", "0", ".", "+", "-0", "0.", ".0"]);
    for (let i = 0; i < 20000; i++)
      values.add(many(r, 6, () => pick(r, NUMBER_TOKENS)));
    for (const v of values) {
      for (const k of [
        "isLength",
        "isBareNumber",
        "isPercent",
        "isBareZero",
        "isZero",
      ] as const)
        expect([k, v, internalScans[k](v)]).toEqual([
          k,
          v,
          referenceScans[k](v),
        ]);
    }
  });
});

describe("sanitizeHtml stays linear on crafted input", () => {
  const SIZE = 100_000;
  const fill = (prefix: string, unit: string, suffix = ""): string =>
    prefix +
    unit.repeat(
      Math.floor((SIZE - prefix.length - suffix.length) / unit.length),
    ) +
    suffix;
  const classes = (n: number, f: (i: number) => string) =>
    Array.from({ length: n }, (_, i) => f(i)).join("");

  // Each of these took between 0.2 and 12 seconds with the original regexes.
  const cases: Record<string, string> = {
    "@-rule name that never reaches a brace": fill(
      "<style>@-",
      "-",
      "</style>",
    ),
    "stylesheet without braces": fill("<style>", "a", "</style>"),
    "@-rule text inside a block": fill("<style>@media x{", "a", "}</style>"),
    "many @-rules ended by semicolons": fill("<style>", "@a;", "</style>"),
    "many @ names before one brace": fill("<style>", "@a", "{</style>"),
    "unclosed comments": fill("<style>", "/*", "</style>"),
    "unclosed style elements": fill("", "<style>"),
    "@ before each cut block": fill("<style>", "@@a{}", "b{}</style>"),
    "long number in a height": fill('<div style="height:', "1", 'x">x</div>'),
    "long zero in a clipped height": fill(
      '<div style="overflow:hidden;height:',
      "0",
      'x">x</div>',
    ),
    "long number in an opacity": fill(
      '<div style="opacity:',
      "1",
      'x">x</div>',
    ),
    "one selector repeated across many elements": `<style>${".a{display:none}".repeat(2500)}</style>${"<b class=a></b>".repeat(4000)}`,
    "many selectors sharing a class": `<style>${classes(3000, (i) => `.a.z${i}{display:none}`)}</style>${"<b class=a></b>".repeat(3000)}`,
    "the same class repeated to raise specificity": `<style>${classes(200, (i) => `${".a".repeat(i + 1)}{display:none}`)}</style>${"<b class=a>x</b>".repeat(3500)}`,
    "many tags sharing a class": `<style>${classes(3000, (i) => `x${i}.a{display:none}`)}</style>${"<b class=a>x</b>".repeat(3000)}`,
    "many restorers sharing a class": `<style>@media x{${classes(3000, (i) => `.a.z${i}{display:block}`)}}</style>${"<b class=a style=display:none></b>".repeat(2000)}`,
  };

  test.each(Object.entries(cases))("%s", (_, html) => {
    expect(html.length).toBeGreaterThan(SIZE * 0.8);
    sanitizeHtml(html);
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      sanitizeHtml(html);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(50);
  });
});

describe("the cascade budget fails closed", () => {
  // Classes u0..u11, a rule showing every subset of them together with `a`,
  // and elements each carrying a different subset: every element matches
  // thousands of rules, and no two are alike, so each pays in full.
  const U = Array.from({ length: 12 }, (_, i) => `u${i}`);
  const subsets: string[][] = [[]];
  for (const u of U) for (const s of [...subsets]) subsets.push([...s, u]);
  const sheet = subsets
    .map((s) => `.${["a", ...s].join(".")}{display:block}`)
    .join("");
  const crafted = (size: number) => {
    let html = `<style>${sheet}</style><p>plain text stays</p>`;
    for (let i = 0; html.length < size; i++)
      html += `<b class="a ${U.filter((_, j) => ((i % 4096) >> j) & 1).join(" ")}">shown-${i}</b>`;
    return html;
  };

  test("elements past the budget are dropped, counted, and cheap", () => {
    const html = crafted(300_000);
    const { html: out, report } = sanitizeHtmlWithReport(html);
    expect(report.cascadeBudgetExceeded).toBeGreaterThan(0);
    expect(report.cascadeBudget).toBe(50_000 + 3 * html.length);
    const shown = (text: string) => (text.match(/shown-/g) ?? []).length;
    expect(shown(out)).toBe(shown(html) - report.cascadeBudgetExceeded);
    expect(out).toContain("plain text stays");
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      sanitizeHtmlWithReport(html);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(100);
  });

  test("parsed emails carry the report", async () => {
    const mime = (type: string, body: string) =>
      Buffer.from(
        `From: a@b.example\r\nTo: c@d.example\r\nSubject: s\r\nMIME-Version: 1.0\r\nContent-Type: ${type}; charset=utf-8\r\n\r\n${body}`,
      );
    const heavy = await parseEmailWithAttachments(
      mime("text/html", crafted(300_000)),
    );
    expect(heavy.htmlSanitizeReport?.cascadeBudgetExceeded).toBeGreaterThan(0);
    const plain = await parseEmailWithAttachments(
      mime("text/html", fixtures[0]?.html ?? ""),
    );
    expect(plain.htmlSanitizeReport?.cascadeBudgetExceeded).toBe(0);
    const text = await parseEmailWithAttachments(mime("text/plain", "hi"));
    expect(text.htmlSanitizeReport).toBeUndefined();
  });

  test("one element matching thousands of rules stays within budget", () => {
    const html = `<style>${sheet}</style><b class="a u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11">x</b>`;
    expect(sanitizeHtmlWithReport(html).report.cascadeBudgetExceeded).toBe(0);
    expect(sanitizeHtml(html)).toBe(referenceSanitizeHtml(html));
  });
});
