import { describe, expect, it } from "vitest";
import {
  detectRawSendMailFetch,
  emitRawSendMailFetchWarning,
  formatRawSendMailFetchWarning,
  RAW_SEND_MAIL_FETCH_WARNING_LINES,
} from "../../../src/oclif/lint/raw-send-mail-fetch.js";

describe("detectRawSendMailFetch", () => {
  it("matches a plain double-quoted inline fetch call to /v1/send-mail", () => {
    const bundle = `
      await fetch("https://api.primitive.dev/v1/send-mail", {
        method: "POST",
        body: JSON.stringify({ to, from, subject, body_text: text }),
      });
    `;
    const result = detectRawSendMailFetch(bundle);
    expect(result.found).toBe(true);
    expect(result.sampleSnippet).not.toBeNull();
    expect(result.sampleSnippet).toContain("send-mail");
  });

  it("matches a single-quoted variant too", () => {
    const bundle = `await fetch('https://api.primitive.dev/v1/send-mail', { method: 'POST' });`;
    expect(detectRawSendMailFetch(bundle).found).toBe(true);
  });

  it("matches a backtick template literal", () => {
    // Backtick form is what handler authors land on when they
    // interpolate the body. The detector should pick this up just
    // like a double-quoted literal because the URL itself is still
    // a static prefix of the literal.
    const bundle =
      "await fetch(`https://api.primitive.dev/v1/send-mail`, { method: 'POST', body });";
    expect(detectRawSendMailFetch(bundle).found).toBe(true);
  });

  it("matches the www variant with /api/v1/send-mail in the path", () => {
    // The pre-PR /docs/functions example used www.primitive.dev,
    // not api.primitive.dev. Run 4's AGX agent copied that exact
    // pattern. The detector has to catch both.
    const bundle = `await fetch("https://www.primitive.dev/api/v1/send-mail", { method: "POST" });`;
    expect(detectRawSendMailFetch(bundle).found).toBe(true);
  });

  it("matches the apex form without a www / api subdomain", () => {
    // After the apex-to-www redirect fix, primitive.dev/api/v1/...
    // works directly. Catch this shape too.
    const bundle = `await fetch("https://primitive.dev/api/v1/send-mail", { method: "POST" });`;
    expect(detectRawSendMailFetch(bundle).found).toBe(true);
  });

  it("ignores a bundle that uses the SDK instead of raw fetch", () => {
    // Roughly what the scaffolded handler bundles to: an import of
    // createPrimitiveClient from @primitivedotdev/sdk/api plus a
    // client.send(...) call. No raw fetch literal at /send-mail.
    const bundle = `
      import { createPrimitiveClient } from "@primitivedotdev/sdk/api";
      export default {
        async fetch(req, env) {
          const client = createPrimitiveClient({ apiKey: env.PRIMITIVE_API_KEY });
          const reply = await client.send({
            from: "you@your-domain.primitive.email",
            to: "alice@example.com",
            subject: "hi",
            bodyText: "hello",
          });
          return Response.json({ ok: true, reply });
        },
      };
    `;
    expect(detectRawSendMailFetch(bundle).found).toBe(false);
  });

  it("ignores fetches to other primitive.dev endpoints (e.g. /send-permissions)", () => {
    // The detector is intentionally narrow. /send-mail is the only
    // empirically observed footgun; we don't flag general
    // primitive.dev calls because customers do legitimately fetch
    // other endpoints (gate probing, account lookups) directly.
    const bundle = `
      await fetch("https://api.primitive.dev/v1/send-permissions?from=x&to=y");
      await fetch("https://api.primitive.dev/v1/account");
    `;
    expect(detectRawSendMailFetch(bundle).found).toBe(false);
  });

  it("does not match similar-looking but non-target paths", () => {
    // Guard against future drift where `/send-mail-something-else`
    // accidentally trips the rule. The trailing `\b` in the regex
    // pins the match to exactly `/send-mail`.
    const bundle = `await fetch("https://api.primitive.dev/v1/send-mail-template-preview");`;
    expect(detectRawSendMailFetch(bundle).found).toBe(false);
  });

  it("does not match a bare comment that mentions the URL", () => {
    // Design choice documented in raw-send-mail-fetch.ts: we anchor
    // on `fetch(` so a stray comment ("// /api/v1/send-mail is the
    // send endpoint") does not produce a false positive. esbuild
    // strips most comments anyway, but anchoring keeps the check
    // honest on bundles that opted out of comment stripping.
    const bundle = `
      // POST to https://api.primitive.dev/v1/send-mail to send mail.
      const x = 1;
    `;
    expect(detectRawSendMailFetch(bundle).found).toBe(false);
  });

  it("does not match fetch() when the URL is a variable", () => {
    // Accepted false negative. Documented in the source. Catching
    // variable-URL cases would need real JS parsing or taint
    // analysis; the inline-literal case is where the documented
    // footgun lives.
    const bundle = `
      const url = "https://api.primitive.dev/v1/send-mail";
      await fetch(url, { method: "POST" });
    `;
    expect(detectRawSendMailFetch(bundle).found).toBe(false);
  });

  it("matches more than once if called twice (regex /g lastIndex reset)", () => {
    // Regression guard: the regex has the /g flag so its
    // lastIndex carries across calls. detectRawSendMailFetch
    // resets lastIndex defensively. Without the reset, the second
    // call against the same input would return found: false.
    const bundle = `await fetch("https://api.primitive.dev/v1/send-mail", {});`;
    expect(detectRawSendMailFetch(bundle).found).toBe(true);
    expect(detectRawSendMailFetch(bundle).found).toBe(true);
  });

  it("includes a single-line whitespace-collapsed snippet of the match", () => {
    const bundle = `
      await fetch(
        "https://api.primitive.dev/v1/send-mail",
        { method: "POST" }
      );
    `;
    const result = detectRawSendMailFetch(bundle);
    expect(result.found).toBe(true);
    // Newlines around the match should be collapsed so the
    // stderr report fits on one line.
    expect(result.sampleSnippet).not.toContain("\n");
    expect(result.sampleSnippet).toContain("send-mail");
  });
});

describe("formatRawSendMailFetchWarning", () => {
  it("includes the three documented beats (name issue, name SDK, link docs) plus the proceed line", () => {
    const text = formatRawSendMailFetchWarning({
      found: true,
      sampleSnippet: null,
    });
    expect(text).toContain("/send-mail");
    expect(text).toContain("createPrimitiveClient");
    expect(text).toContain("@primitivedotdev/sdk/api");
    expect(text).toContain("https://www.primitive.dev/docs/functions");
    expect(text).toContain("Continuing with deploy");
  });

  it("contains no em dashes or double-hyphen punctuation", () => {
    // The repo's pre-commit hook blocks em dashes. The warning
    // text ships into stderr but also into PR descriptions and
    // changelog notes; keep punctuation simple regardless.
    const text = RAW_SEND_MAIL_FETCH_WARNING_LINES.join(" ");
    expect(text).not.toMatch(/—/); // em dash
    expect(text).not.toMatch(/–/); // en dash
    expect(text).not.toMatch(/--/);
  });

  it("appends the sample snippet on a `found:` line when one is supplied", () => {
    const text = formatRawSendMailFetchWarning({
      found: true,
      sampleSnippet: `await fetch("https://api.primitive.dev/v1/send-mail",`,
    });
    expect(text).toContain("found:");
    expect(text).toContain("send-mail");
  });

  it("omits the snippet line when no snippet is provided", () => {
    const text = formatRawSendMailFetchWarning({
      found: true,
      sampleSnippet: null,
    });
    expect(text).not.toContain("found:");
  });
});

describe("emitRawSendMailFetchWarning", () => {
  it("writes the warning to the provided writer when the pattern is found", () => {
    const chunks: string[] = [];
    const finding = emitRawSendMailFetchWarning(
      `await fetch("https://api.primitive.dev/v1/send-mail", {});`,
      (chunk) => chunks.push(chunk),
    );
    expect(finding.found).toBe(true);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain("warning:");
    expect(chunks[0]).toContain("createPrimitiveClient");
  });

  it("writes nothing when the pattern is not found", () => {
    const chunks: string[] = [];
    const finding = emitRawSendMailFetchWarning(
      `import { createPrimitiveClient } from "@primitivedotdev/sdk/api"; client.send({});`,
      (chunk) => chunks.push(chunk),
    );
    expect(finding.found).toBe(false);
    expect(chunks).toEqual([]);
  });
});
