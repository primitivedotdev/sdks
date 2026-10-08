import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAIL_RELAY_FLAG_DESCRIPTION,
  MAIL_RELAY_NOT_ENABLED_MESSAGE,
  MAIL_RELAY_UNAVAILABLE_MESSAGE,
  OPERATION_ERROR_HINTS,
} from "../../src/oclif/api-command.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const API_BASE_URL = "https://api.domains-add.test/v1";

type Runnable = {
  flags: Record<string, { description?: string; type?: string }>;
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

const created = (): Response =>
  jsonResponse(201, {
    success: true,
    data: {
      id: "dom-1",
      domain: "example.com",
      verified: false,
      dns_records: [],
    },
  });

let response: () => Response = created;
let requestBodies: unknown[] = [];
let savedEnv: Record<string, string | undefined> = {};
let tempHome = "";

beforeEach(() => {
  savedEnv = {};
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("PRIMITIVE_")) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
  }
  tempHome = mkdtempSync(join(tmpdir(), "primitive-domains-add-"));
  for (const [name, value] of Object.entries({
    HOME: tempHome,
    XDG_CONFIG_HOME: join(tempHome, "config"),
    PRIMITIVE_CONFIG_DIR: join(tempHome, "config", "primitive"),
    PRIMITIVE_API_KEY: "prim_test_domains_add",
    PRIMITIVE_API_BASE_URL: API_BASE_URL,
    PRIMITIVE_SKIP_NEW_VERSION_CHECK: "true",
  })) {
    if (!(name in savedEnv)) savedEnv[name] = process.env[name];
    process.env[name] = value;
  }
  response = created;
  requestBodies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : undefined;
      const text = request
        ? await request.clone().text()
        : typeof init?.body === "string"
          ? init.body
          : undefined;
      requestBodies.push(text ? JSON.parse(text) : undefined);
      return response();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(tempHome, { force: true, recursive: true });
});

async function runAdd(
  argv: string[],
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  const command = COMMANDS["domains:add-domain"] as unknown as Runnable;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }),
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      stdout.push(`${args.map(String).join(" ")}\n`);
    }),
  ];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    await command.run(argv, { root: CLI_ROOT });
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  const exitCode = typeof process.exitCode === "number" ? process.exitCode : 0;
  process.exitCode = previousExitCode;
  return { exitCode, stderr: stderr.join(""), stdout: stdout.join("") };
}

describe("domains add --mail-relay", () => {
  it("registers a boolean --mail-relay flag with the relay help text", () => {
    const command = COMMANDS["domains:add-domain"] as unknown as Runnable;
    const flag = command.flags["mail-relay"];
    expect(flag?.type).toBe("boolean");
    expect(flag?.description).toBe(MAIL_RELAY_FLAG_DESCRIPTION);
    expect(MAIL_RELAY_FLAG_DESCRIPTION).toContain(
      "Keep your existing mailbox provider",
    );
    expect(MAIL_RELAY_FLAG_DESCRIPTION).toContain("Google Workspace only");
  });

  it("is reachable through the domains:add alias", () => {
    expect(COMMANDS["domains:add"]).toBe(COMMANDS["domains:add-domain"]);
  });

  it("sends mail_relay: true when the flag is passed", async () => {
    const result = await runAdd(["--domain", "example.com", "--mail-relay"]);
    expect(result.exitCode).toBe(0);
    expect(requestBodies).toEqual([
      { domain: "example.com", mail_relay: true },
    ]);
    expect(JSON.parse(result.stdout)).toMatchObject({ id: "dom-1" });
  });

  it("omits mail_relay when the flag is not passed", async () => {
    const result = await runAdd(["--domain", "example.com"]);
    expect(result.exitCode).toBe(0);
    expect(requestBodies).toEqual([{ domain: "example.com" }]);
  });

  it("merges --mail-relay into a --raw-body payload", async () => {
    await runAdd(["--raw-body", '{"domain":"example.com"}', "--mail-relay"]);
    expect(requestBodies).toEqual([
      { domain: "example.com", mail_relay: true },
    ]);
  });

  it("explains a 403 feature_disabled response", async () => {
    response = () =>
      jsonResponse(403, {
        success: false,
        error: {
          code: "feature_disabled",
          message: "Mail relay domains are not enabled for this organization.",
          details: { missing_entitlement: "mail_relay" },
        },
      });
    const result = await runAdd(["--domain", "example.com", "--mail-relay"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"code": "feature_disabled"');
    expect(result.stderr).toContain(MAIL_RELAY_NOT_ENABLED_MESSAGE);
  });

  it("explains a 503 mail_relay_unavailable response", async () => {
    response = () =>
      jsonResponse(503, {
        success: false,
        error: {
          code: "mail_relay_unavailable",
          message: "No mail relay is configured in this environment.",
        },
      });
    const result = await runAdd(["--domain", "example.com", "--mail-relay"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"code": "mail_relay_unavailable"');
    expect(result.stderr).toContain(MAIL_RELAY_UNAVAILABLE_MESSAGE);
  });
});

describe("OPERATION_ERROR_HINTS.addDomain", () => {
  const hint = OPERATION_ERROR_HINTS.addDomain;

  it("attributes feature_disabled to mail relay only when the request asked for it", () => {
    expect(hint?.("feature_disabled", { mail_relay: true })).toBe(
      MAIL_RELAY_NOT_ENABLED_MESSAGE,
    );
    expect(hint?.("feature_disabled", { domain: "example.com" })).toBe(
      undefined,
    );
  });

  it("has nothing to add for other codes", () => {
    expect(hint?.("conflict", { mail_relay: true })).toBe(undefined);
    expect(hint?.(undefined, undefined)).toBe(undefined);
  });
});
