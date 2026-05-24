import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FUNCTION_TEMPLATES,
  isValidFunctionName,
  renderHandler,
  renderPackageJson,
  scaffoldFiles,
  writeScaffold,
} from "../../src/oclif/commands/functions-init.js";
import {
  DEFAULT_FUNCTION_TEMPLATE_ID,
  formatFunctionTemplateList,
  PRIMITIVE_TEAM_AUTHOR,
  serializeFunctionTemplate,
} from "../../src/oclif/function-templates.js";
import { COMMANDS } from "../../src/oclif/index.js";

describe("functions:init command registration", () => {
  it("registers in the COMMANDS map", () => {
    expect(COMMANDS["functions:init"]).toBeDefined();
  });

  it("registers the template-listing command in the COMMANDS map", () => {
    expect(COMMANDS["functions:templates"]).toBeDefined();
  });
});

describe("isValidFunctionName", () => {
  it("accepts simple slug-style names", () => {
    expect(isValidFunctionName("my-fn")).toBe(true);
    expect(isValidFunctionName("forwarder")).toBe(true);
    expect(isValidFunctionName("test_fn_2")).toBe(true);
    expect(isValidFunctionName("a")).toBe(true);
  });

  it("rejects uppercase, dots, spaces, slashes, and path traversal", () => {
    expect(isValidFunctionName("MyFn")).toBe(false);
    expect(isValidFunctionName("my.fn")).toBe(false);
    expect(isValidFunctionName("my fn")).toBe(false);
    expect(isValidFunctionName("my/fn")).toBe(false);
    expect(isValidFunctionName("../escape")).toBe(false);
    expect(isValidFunctionName("")).toBe(false);
  });

  it("rejects leading hyphen or underscore", () => {
    // First character must be a letter or digit so the name is safe
    // to use as a directory name and as a positional CLI argument.
    expect(isValidFunctionName("-leading")).toBe(false);
    expect(isValidFunctionName("_leading")).toBe(false);
  });
});

describe("renderHandler", () => {
  it("imports the SDK surface from @primitivedotdev/sdk/api, NOT the root", () => {
    // This is the regression guard for the Run 4 footgun: importing
    // from the package root pulls in node:crypto-dependent webhook
    // helpers and breaks Workers-style bundles. The scaffolder must
    // teach the /api subpath specifically. The import block must
    // include createPrimitiveClient (for outbound), normalizeReceivedEmail
    // (so client.reply gets threading metadata so --show-sends works),
    // the Workers-safe signature verification helpers, and the
    // EmailReceivedEvent type.
    const handler = renderHandler();
    expect(handler).toMatch(/from\s+"@primitivedotdev\/sdk\/api"/);
    expect(handler).toContain("createPrimitiveClient");
    expect(handler).toContain("normalizeReceivedEmail");
    expect(handler).toContain("PRIMITIVE_SIGNATURE_HEADER");
    expect(handler).toContain("verifyWebhookSignature");
    expect(handler).toContain("WebhookVerificationError");
    expect(handler).toContain("EmailReceivedEvent");
    expect(handler).not.toMatch(/from\s+"@primitivedotdev\/sdk"\s*;/);
    expect(handler).not.toMatch(/from\s+"@primitivedotdev\/sdk\/webhook"/);
  });

  it("exports a Worker-style default with async fetch(req, env)", () => {
    const handler = renderHandler();
    expect(handler).toContain("export default {");
    expect(handler).toContain("async fetch(");
  });

  it("verifies Primitive-Signature against the raw body before parsing JSON", () => {
    const handler = renderHandler();

    const rawBodyIndex = handler.indexOf("const rawBody = await req.text();");
    const verifyIndex = handler.indexOf("await verifyWebhookSignature({");
    const parseIndex = handler.indexOf("JSON.parse(rawBody)");

    expect(rawBodyIndex).toBeGreaterThanOrEqual(0);
    expect(verifyIndex).toBeGreaterThan(rawBodyIndex);
    expect(parseIndex).toBeGreaterThan(verifyIndex);
    expect(handler).toContain("PRIMITIVE_WEBHOOK_SECRET");
    expect(handler).toContain(
      'new Response("invalid signature", { status: 401 })',
    );
    expect(handler).not.toContain("await req.json()");
    expect(handler).not.toMatch(/gateway has already HMAC-verified/i);
  });

  it("calls client.reply (not client.send) so the inbound's replies array gets populated", () => {
    // The whole point of this scaffolder is to ship a handler that
    // uses the SDK rather than raw fetch against /api/v1/send-mail.
    // client.reply specifically (not client.send) so the server-side
    // in_reply_to_email_id FK gets set, which is what makes the
    // inbound's `replies` array populate and `functions:test-function
    // --show-sends` surface this handler's outbound.
    const handler = renderHandler();
    expect(handler).toContain("client.reply(");
    expect(handler).toContain("normalizeReceivedEmail(event)");
    expect(handler).not.toContain("client.send(");
    expect(handler).not.toContain("/api/v1/send-mail");
  });

  it("documents that PRIMITIVE_API_KEY is auto-injected by the runtime", () => {
    const handler = renderHandler();
    expect(handler).toContain("PRIMITIVE_API_KEY");
    expect(handler).toContain("PRIMITIVE_WEBHOOK_SECRET");
    expect(handler).toContain("auto-injected");
  });

  it("branches on event.event so future event types do not retry-loop", () => {
    // AGX feedback: handlers that assume every POST is email.received
    // start throwing the day Primitive adds another event type, which
    // Primitive then retries 6 times with backoff. A discriminator
    // guard in the scaffold defaults users into the safe shape.
    const handler = renderHandler();
    expect(handler).toContain('event.event !== "email.received"');
    expect(handler).toMatch(/skipped:\s*event\.event/);
  });

  it("wraps the body in try/catch returning 2xx on caught errors", () => {
    // AGX feedback: a thrown handler is retried up to 6 times by the
    // webhook delivery loop, which burns the invocation budget on
    // bugs that won't fix themselves. Catching and returning 2xx is
    // the safer default; the scaffold documents the tradeoff so the
    // user can flip to 5xx if they actually want retries.
    const handler = renderHandler();
    expect(handler).toContain("try {");
    expect(handler).toContain("} catch (err) {");
    expect(handler).toContain("console.error(");
    // Caught path still returns 2xx (status: 200 explicit on the
    // error branch so the intent is unmistakable).
    expect(handler).toMatch(/status:\s*200/);
  });

  it("explains the recipient gate above the SDK send call", () => {
    // The single biggest "I think the product is broken" surprise
    // across AGX runs is the outbound recipient gate. A short pointer
    // to the docs above the send() call defuses it before the handler
    // ships.
    const handler = renderHandler();
    expect(handler).toContain(
      "https://www.primitive.dev/docs/sending#who-you-can-send-to",
    );
    expect(handler).toMatch(/recipient_not_allowed/i);
  });
});

describe("renderHandler loop protection + REPLY_FROM constant", () => {
  it("declares a REPLY_FROM constant scoped to loop protection", () => {
    // REPLY_FROM is the loop-protection knob: handlers that send
    // outbound from a non-managed domain need to recognize replies
    // returning to that address as self-traffic. The comment above
    // the const must make it clear this is for the isLoop helper
    // (not a literal "TODO replace before deploying" — the scaffolder
    // no longer wires REPLY_FROM into the outbound from-address;
    // client.reply lets the server default it).
    const handler = renderHandler();
    expect(handler).toContain("const REPLY_FROM =");
    const beforeConst = handler.slice(0, handler.indexOf("const REPLY_FROM"));
    expect(beforeConst).toMatch(/loop[- ]protection/i);
  });

  it("exposes an isLoop helper that the handler calls before dispatching", () => {
    // AGX feedback: a newly deployed function starts as a fallback
    // endpoint for managed *.primitive.email domains, including bounces
    // from its own outbound traffic when no domain-scoped endpoint
    // suppresses fallback routing. Without a loop guard the handler can
    // respond to its own bounces and fan out indefinitely. The default
    // scaffold ships the guard so users do not have to discover the need
    // for it after a fan-out incident.
    const handler = renderHandler();
    expect(handler).toMatch(
      /export function isLoop\(event: EmailReceivedEvent\): boolean/,
    );
    // The fetch dispatcher must call the helper and short-circuit on
    // true; the early-return body marks the skip reason as "loop" so
    // operators can filter invocation logs by it.
    expect(handler).toContain("if (isLoop(event))");
    expect(handler).toMatch(/skipped:\s*["']loop["']/);
  });

  it("isLoop covers the managed *.primitive.email suffix and the REPLY_FROM address", () => {
    // The default predicate has two arms: any From on a managed
    // *.primitive.email address (covers bounces from
    // mailer-daemon@*.primitive.email as well as the simple self-reply
    // case), and the configured
    // REPLY_FROM. Comparisons are case-insensitive because RFC 2822
    // email-address local parts are case-insensitive in practice.
    const handler = renderHandler();
    expect(handler).toContain(".primitive.email");
    expect(handler).toContain("REPLY_FROM.toLowerCase()");
    // Substring match (.includes), not strict equality: the From
    // header can be a bare address or display-name form.
    expect(handler).toMatch(/from\.includes\(["']\.primitive\.email["']\)/);
    expect(handler).not.toMatch(
      /event\.email\.headers\.from\s*===\s*REPLY_FROM/,
    );
  });

  it("documents that the default isLoop is intentionally small and where to extend", () => {
    // The default helper covers managed-domain mail (anything on
    // *.primitive.email). Auto-Submitted detection, Message-ID chain
    // tracking, and signup-email matching are deliberately left to
    // the user. The comment block above isLoop must list these as
    // extension points so the next person knows where to add the
    // sophistication.
    const handler = renderHandler();
    const beforeHelper = handler.slice(
      0,
      handler.indexOf("export function isLoop"),
    );
    expect(beforeHelper).toContain("auto-submitted");
    expect(beforeHelper).toContain("Message-ID");
    expect(beforeHelper).toMatch(/signup/i);
  });

  it("includes a recipient-routing comment block pointing at event.email.headers.to", () => {
    // The recipient-routing pattern lets a single function fan out
    // per-address logic (e.g. support@ vs sales@). A short comment in
    // the scaffold surfaces the pattern without forcing the author to
    // discover it in the docs.
    const handler = renderHandler();
    expect(handler).toContain("Recipient routing:");
    expect(handler).toContain("event.email.headers.to");
  });

  it("uses REPLY_FROM only inside isLoop, never as an outbound from-address", () => {
    // Post-client.reply scaffolder: REPLY_FROM is loop-protection-only.
    // client.reply server-defaults the outbound from-address from the
    // inbound recipient, so the scaffolded handler must NOT pass
    // REPLY_FROM as `from` to any send/reply call. The placeholder
    // address itself must still appear exactly once (in the const).
    const handler = renderHandler();
    const occurrences = (
      handler.match(/you@your-domain\.primitive\.email/g) ?? []
    ).length;
    expect(occurrences).toBe(1);
    expect(handler).not.toContain("from: REPLY_FROM");
    expect(handler).not.toMatch(
      /to:\s*event\.email\.headers\.from\s*\?\?\s*REPLY_FROM/,
    );
    // REPLY_FROM must still be referenced by isLoop (loop-protection use).
    expect(handler).toMatch(/REPLY_FROM\.toLowerCase\(\)/);
  });
});

describe("renderPackageJson", () => {
  it("is valid JSON and substitutes the function name into the package name", () => {
    const raw = renderPackageJson("test-fn");
    const parsed = JSON.parse(raw) as {
      name: string;
      type: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(parsed.name).toBe("test-fn");
    expect(parsed.type).toBe("module");
    expect(parsed.dependencies["@primitivedotdev/sdk"]).toMatch(/^\^/);
    expect(parsed.devDependencies.esbuild).toMatch(/^\^/);
  });

  it("includes @primitivedotdev/cli as a devDependency so node_modules/.bin/primitive resolves to the new CLI, not the SDK alias", () => {
    // AGX feedback: scaffolded projects with only the SDK as a dep
    // hit the SDK package's deprecated CLI bin every time `npm run
    // deploy` runs, which prints the "CLI moved" stderr banner.
    // Pinning the CLI as a devDep makes the scaffold self-contained.
    const raw = renderPackageJson("test-fn");
    const parsed = JSON.parse(raw) as {
      devDependencies: Record<string, string>;
    };
    expect(parsed.devDependencies["@primitivedotdev/cli"]).toMatch(/^\^/);
  });

  it("ships @primitivedotdev/cli at a range that includes this CLI's own published version", () => {
    // Regression guard: the scaffolded @primitivedotdev/cli devDep
    // must include this CLI's own version. Otherwise a `primitive
    // functions:init` run from CLI 0.26 could scaffold a project
    // pinned at ^0.25.0, silently downgrading the bin the user just
    // installed. The previous caret-only check was too weak: it
    // passed even if the major or minor diverged. This test ties
    // the constant to package.json so a version bump that forgets
    // to update CLI_VERSION_RANGE fails CI.
    const cliPkgPath = resolve(__dirname, "../../package.json");
    const cliPkg = JSON.parse(readFileSync(cliPkgPath, "utf8")) as {
      version: string;
    };
    const scaffolded = JSON.parse(renderPackageJson("test-fn")) as {
      devDependencies: Record<string, string>;
    };
    const range = scaffolded.devDependencies["@primitivedotdev/cli"];

    // Range must be a caret on a 3-part semver: ^X.Y.Z.
    const rangeMatch = range.match(/^\^(\d+)\.(\d+)\.(\d+)$/);
    expect(rangeMatch, `unexpected CLI range shape: ${range}`).not.toBeNull();
    if (!rangeMatch) return;
    const [, rangeMajor, rangeMinor, rangePatch] = rangeMatch;

    // CLI's own version must satisfy the caret range. For 0.y.z
    // packages, ^0.y.z resolves to >=0.y.z <0.(y+1).0, so the CLI's
    // major must equal the range major (typically 0) AND the CLI's
    // minor must equal the range minor AND the CLI's patch must be
    // >= the range patch.
    const cliMatch = cliPkg.version.match(/^(\d+)\.(\d+)\.(\d+)/);
    expect(
      cliMatch,
      `CLI version not semver-shaped: ${cliPkg.version}`,
    ).not.toBeNull();
    if (!cliMatch) return;
    const [, cliMajor, cliMinor, cliPatch] = cliMatch;

    expect(cliMajor).toBe(rangeMajor);
    expect(cliMinor).toBe(rangeMinor);
    expect(Number(cliPatch)).toBeGreaterThanOrEqual(Number(rangePatch));
  });

  it("pins the scaffolded @primitivedotdev/sdk to a 3-part caret range", () => {
    // Regression guard: scaffolded projects target a specific SDK
    // line. The cli used to derive that range from its own
    // `@primitivedotdev/sdk` runtime dep, but the CLI no longer
    // depends on the SDK at runtime (the generated API surface lives
    // in the workspace-internal api-core package and is bundled into
    // the CLI tarball). The scaffolded SDK range is now driven by
    // the SDK_VERSION_RANGE constant in src/oclif/commands/
    // functions-init.ts; this test pins the shape so a future bump
    // to a malformed range fails CI.
    const scaffolded = JSON.parse(renderPackageJson("test-fn")) as {
      dependencies: Record<string, string>;
    };
    const range = scaffolded.dependencies["@primitivedotdev/sdk"];
    expect(range, "scaffolded SDK range is missing").toBeDefined();
    expect(
      range.match(/^\^\d+\.\d+\.\d+$/),
      `unexpected SDK range shape: ${range}`,
    ).not.toBeNull();
  });

  it("substitutes the function name into the deploy script", () => {
    const raw = renderPackageJson("forwarder");
    const parsed = JSON.parse(raw) as { scripts: Record<string, string> };
    expect(parsed.scripts.deploy).toContain("--name forwarder");
    expect(parsed.scripts.deploy).toContain("./dist/handler.js");
  });

  it("uses PRIMITIVE_FUNCTION_ID in the redeploy script for cross-shell portability", () => {
    const raw = renderPackageJson("forwarder");
    const parsed = JSON.parse(raw) as { scripts: Record<string, string> };
    expect(parsed.scripts.redeploy).toContain("$PRIMITIVE_FUNCTION_ID");
  });
});

describe("scaffoldFiles", () => {
  it("lists all six expected files in stable order", () => {
    const files = scaffoldFiles("my-fn").map((f) => f.relativePath);
    expect(files).toEqual([
      "handler.ts",
      "package.json",
      "build.mjs",
      "tsconfig.json",
      ".gitignore",
      "README.md",
    ]);
  });

  it("uses the default email-reply template when no template is specified", () => {
    const defaultFiles = scaffoldFiles("my-fn");
    const explicitFiles = scaffoldFiles("my-fn", DEFAULT_FUNCTION_TEMPLATE_ID);
    expect(defaultFiles).toEqual(explicitFiles);
  });

  it("rejects unknown template ids before writing files", () => {
    expect(() => scaffoldFiles("my-fn", "does-not-exist")).toThrow(
      /Unknown function template/,
    );
  });
});

describe("FUNCTION_TEMPLATES", () => {
  it("starts as a Primitive-owned email-reply template", () => {
    expect(FUNCTION_TEMPLATES.map((template) => template.id)).toEqual([
      "email-reply",
    ]);
    expect(FUNCTION_TEMPLATES[0]?.author.id).toBe("primitive-team");
    expect(FUNCTION_TEMPLATES[0]?.tags).toContain("email");
  });

  it("serializes metadata without renderer functions for agent discovery", () => {
    const serialized = serializeFunctionTemplate(FUNCTION_TEMPLATES[0]);
    expect(serialized).toMatchObject({
      author: { id: "primitive-team", name: "Primitive Team" },
      id: "email-reply",
      title: "Email Reply",
    });
    expect(serialized).not.toHaveProperty("files");
  });

  it("defensively copies the template author in serialized metadata", () => {
    const serialized = serializeFunctionTemplate(FUNCTION_TEMPLATES[0]);
    serialized.author.name = "Mutated";
    expect(PRIMITIVE_TEAM_AUTHOR.name).toBe("Primitive Team");
    expect(FUNCTION_TEMPLATES[0]?.author.name).toBe("Primitive Team");
  });

  it("formats a human-readable template list with init guidance", () => {
    const output = formatFunctionTemplateList(FUNCTION_TEMPLATES);
    expect(output).toContain("email-reply");
    expect(output).toContain("Primitive Team");
    expect(output).toContain("primitive functions init <name> --template <id>");
  });
});

describe("writeScaffold", () => {
  let workRoot: string;

  beforeEach(() => {
    workRoot = mkdtempSync(join(tmpdir(), "primitive-functions-init-"));
  });

  afterEach(() => {
    rmSync(workRoot, { force: true, recursive: true });
  });

  it("writes the expected files with the expected substitutions into a fresh dir", () => {
    const outDir = resolve(workRoot, "test-fn");
    writeScaffold({ name: "test-fn", outDir });

    const entries = readdirSync(outDir).sort();
    expect(entries).toEqual(
      [
        ".gitignore",
        "README.md",
        "build.mjs",
        "handler.ts",
        "package.json",
        "tsconfig.json",
      ].sort(),
    );

    const handler = readFileSync(resolve(outDir, "handler.ts"), "utf8");
    expect(handler).toMatch(/from\s+"@primitivedotdev\/sdk\/api"/);
    expect(handler).toContain("createPrimitiveClient");
    expect(handler).toContain("normalizeReceivedEmail");

    const pkg = JSON.parse(
      readFileSync(resolve(outDir, "package.json"), "utf8"),
    ) as { name: string; scripts: Record<string, string> };
    expect(pkg.name).toBe("test-fn");
    expect(pkg.scripts.deploy).toContain("--name test-fn");

    const buildMjs = readFileSync(resolve(outDir, "build.mjs"), "utf8");
    expect(buildMjs).toContain('conditions: ["worker", "browser"]');
    // Backlog item 20: the docs example referenced "workerd" which is
    // not in the SDK package.json's exports conditions. Make sure we
    // don't accidentally re-introduce the dead condition here.
    expect(buildMjs).not.toContain("workerd");

    const tsconfig = JSON.parse(
      readFileSync(resolve(outDir, "tsconfig.json"), "utf8"),
    ) as {
      compilerOptions: { types: string[]; lib: string[] };
    };
    expect(tsconfig.compilerOptions.types).toEqual([]);
    expect(tsconfig.compilerOptions.lib).toContain("WebWorker");

    const gitignore = readFileSync(resolve(outDir, ".gitignore"), "utf8");
    expect(gitignore).toContain("node_modules");
    expect(gitignore).toContain("dist");

    const readme = readFileSync(resolve(outDir, "README.md"), "utf8");
    expect(readme).toContain("# test-fn");
    expect(readme).toContain("npm run deploy");
  });

  it("refuses to overwrite an existing directory and leaves it untouched", () => {
    const outDir = resolve(workRoot, "already-here");
    // Pre-create the target with a sentinel file so we can verify the
    // scaffolder didn't trample it.
    writeScaffold({ name: "already-here", outDir });
    const sentinelBefore = readFileSync(resolve(outDir, "handler.ts"), "utf8");

    expect(() => writeScaffold({ name: "already-here", outDir })).toThrow(
      /already exists/,
    );

    // The pre-existing handler must be exactly as it was before the
    // second call: no partial overwrite, no half-rolled-back state.
    const sentinelAfter = readFileSync(resolve(outDir, "handler.ts"), "utf8");
    expect(sentinelAfter).toBe(sentinelBefore);
  });

  it("rejects an invalid function name and writes nothing", () => {
    const outDir = resolve(workRoot, "bad");
    expect(() => writeScaffold({ name: "Bad Name", outDir })).toThrow(
      /Invalid function name/,
    );

    // The outDir was never created because we bail before touching
    // the filesystem.
    expect(() => readdirSync(outDir)).toThrow();
  });

  it("rejects an unknown template id and writes nothing", () => {
    const outDir = resolve(workRoot, "bad-template");
    expect(() =>
      writeScaffold({
        name: "bad-template",
        outDir,
        templateId: "does-not-exist",
      }),
    ).toThrow(/Unknown function template/);

    expect(() => readdirSync(outDir)).toThrow();
  });
});
