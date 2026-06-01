import { describe, expect, test } from "vitest";
import { sanitizeHtml } from "../../src/parser/sanitize-html.js";

describe("sanitizeHtml — XSS removal", () => {
  test("drops <script> tags and their contents", () => {
    const out = sanitizeHtml("<p>hi</p><script>alert(1)</script>");
    expect(out).toContain("<p>hi</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert(1)");
  });

  test("strips on* event handler attributes", () => {
    const out = sanitizeHtml(
      '<img src="https://ok.test/a.png" onerror="alert(1)">',
    );
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
  });

  test("strips javascript: hrefs but keeps the anchor", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).toContain(">x</a>");
    expect(out).not.toContain("javascript:");
  });

  test("removes iframe / object / embed / form / input", () => {
    for (const html of [
      '<iframe src="https://evil.test"></iframe>',
      "<object data=evil></object>",
      "<embed src=evil>",
      "<form action=evil><input name=x></form>",
    ]) {
      const out = sanitizeHtml(html);
      expect(out).not.toMatch(/iframe|object|embed|<form|<input/);
    }
  });

  test("removes <style> tag and its contents", () => {
    const out = sanitizeHtml("<style>body{display:none}</style><p>ok</p>");
    expect(out).toBe("<p>ok</p>");
  });

  test("strips style attributes", () => {
    const out = sanitizeHtml('<p style="position:fixed">x</p>');
    expect(out).not.toContain("style");
    expect(out).toContain(">x</p>");
  });

  test("drops data-* attributes", () => {
    const out = sanitizeHtml('<p data-track="1">x</p>');
    expect(out).not.toContain("data-track");
  });

  test("removes svg/math wrappers and any nested executable content (mXSS)", () => {
    const out = sanitizeHtml(
      "<div><p>keep</p><math><mi><iframe src=//evil></iframe></mi></math></div>",
    );
    expect(out).toContain("<p>keep</p>");
    expect(out).not.toMatch(/math|mi|iframe|evil/);
  });

  test("rejects protocol-relative URLs", () => {
    const out = sanitizeHtml('<a href="//evil.test/x">x</a>');
    expect(out).not.toContain("//evil.test");
  });
});

describe("sanitizeHtml — data: URI policy", () => {
  test("blocks data:image/svg+xml on img src (can embed JS)", () => {
    const out = sanitizeHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=">');
    expect(out).not.toContain("data:image/svg+xml");
  });

  test("blocks data:image/svg+xml on anchor href", () => {
    const out = sanitizeHtml(
      '<a href="data:image/svg+xml;base64,PHN2Zz4=">x</a>',
    );
    expect(out).not.toContain("data:image/svg+xml");
  });

  test("allows raster data:image/* on img (inline CID images)", () => {
    const src = "data:image/png;base64,iVBORw0KGgo=";
    const out = sanitizeHtml(`<img src="${src}" alt="a">`);
    expect(out).toContain(src);
  });
});

describe("sanitizeHtml — allowed content preserved", () => {
  test("keeps safe formatting, links, and tables", () => {
    const html =
      '<table><tbody><tr><td><b>x</b> <a href="https://ok.test">l</a></td></tr></tbody></table>';
    const out = sanitizeHtml(html);
    expect(out).toContain("<table>");
    expect(out).toContain("<b>x</b>");
    expect(out).toContain('href="https://ok.test"');
  });

  test("keeps https image with alt", () => {
    const out = sanitizeHtml('<img src="https://ok.test/a.png" alt="a">');
    expect(out).toContain('src="https://ok.test/a.png"');
    expect(out).toContain('alt="a"');
  });

  test("strips target=_blank (window.opener attack prevention)", () => {
    const out = sanitizeHtml('<a href="https://ok.test" target="_blank">x</a>');
    expect(out).toContain('href="https://ok.test"');
    expect(out).not.toContain("target=");
  });

  test("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});
