import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getInboxStatus: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getInboxStatus: mocks.getInboxStatus,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import InboxSetupCommand, {
  buildInboxSetupGuide,
  formatInboxSetupGuide,
} from "../../src/oclif/commands/inbox-setup.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
let tempConfigHome: string;
let previousXdgConfigHome: string | undefined;

function makeDomain(overrides: Record<string, unknown> = {}) {
  return {
    id: "domain-1",
    domain: "long-ape.primitive.email",
    verified: true,
    active: true,
    managed: true,
    receiving_ready: true,
    processing_ready: false,
    processing_route_count: 0,
    endpoint_count: 0,
    enabled_endpoint_count: 0,
    function_endpoint_count: 0,
    email_count: 2,
    latest_email_received_at: "2026-05-25T07:00:00.000Z",
    status: "stored_only",
    ...overrides,
  } as never;
}

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    ready: false,
    receiving_ready: true,
    processing_ready: false,
    summary:
      "Inbound mail can be received and stored, but no processing route is enabled.",
    next_actions: [],
    domains: [makeDomain()],
    endpoints: {
      total: 0,
      enabled: 0,
      disabled: 0,
      fallback_enabled: 0,
      domain_scoped_enabled: 0,
      http_enabled: 0,
      function_enabled: 0,
    },
    functions: {
      total: 0,
      deployed: 0,
      pending: 0,
      failed: 0,
    },
    recent_emails: {
      total: 2,
      latest_received_at: "2026-05-25T07:00:00.000Z",
    },
    ...overrides,
  } as never;
}

async function runInboxSetupCommand(argv: string[]): Promise<{
  exitCode: NodeJS.Process["exitCode"];
  stdout: string;
}> {
  const stdoutChunks: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdoutChunks.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);

  try {
    await InboxSetupCommand.run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stdout: stdoutChunks.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

describe("inbox setup command registration", () => {
  it("registers the guided setup command", () => {
    expect(COMMANDS["inbox:setup"]).toBe(InboxSetupCommand);
    expect(InboxSetupCommand.summary).toMatch(/Guide inbound email setup/);
  });

  it("exposes --json and auth flags", () => {
    const flags = InboxSetupCommand.flags as Record<string, unknown>;

    expect(flags.json).toBeDefined();
    expect(flags["api-key"]).toBeDefined();
  });
});

describe("inbox setup guide formatting", () => {
  it("shows stored-only state and exact Function setup commands", () => {
    const guide = buildInboxSetupGuide(makeStatus());
    const output = formatInboxSetupGuide(guide);

    expect(guide.readiness.mode).toBe("stored_only");
    expect(guide.receive).toMatchObject({
      address: "inbox@long-ape.primitive.email",
      domain: "long-ape.primitive.email",
      managed: true,
    });
    expect(output).toContain("Mode: stored-only");
    expect(output).toContain("primitive functions init inbound-reply");
    expect(output).toContain("cd inbound-reply");
    expect(output).toContain("npm install");
    expect(output).toContain("npm run build");
    expect(output).toContain(
      "primitive functions deploy --name inbound-reply --file ./dist/handler.js --wait",
    );
    expect(output).toContain(
      "primitive functions test --id <function-id> --wait --show-sends",
    );
    expect(output).toContain("primitive functions logs --id <function-id>");
    expect(output).toContain("Inbound id");
    expect(output).toContain("Function id");
    expect(output).toContain("Invocation status");
    expect(output).toContain("Reply/send result");
  });

  it("shows active processing without scaffold steps", () => {
    const guide = buildInboxSetupGuide(
      makeStatus({
        ready: true,
        processing_ready: true,
        endpoints: {
          total: 1,
          enabled: 1,
          disabled: 0,
          fallback_enabled: 1,
          domain_scoped_enabled: 0,
          http_enabled: 0,
          function_enabled: 1,
        },
        functions: {
          total: 1,
          deployed: 1,
          pending: 0,
          failed: 0,
        },
      }),
    );
    const output = formatInboxSetupGuide(guide);

    expect(guide.readiness.mode).toBe("actively_processed");
    expect(output).toContain("Mode: actively processed");
    expect(output).not.toContain("primitive functions init inbound-reply");
    expect(output).toContain(
      "primitive functions test --id <function-id> --wait --show-sends",
    );
  });

  it("does not suggest Function scaffold steps before mail can be received", () => {
    const guide = buildInboxSetupGuide(
      makeStatus({
        receiving_ready: false,
        domains: [
          makeDomain({
            receiving_ready: false,
            status: "pending_dns",
          }),
        ],
      }),
    );
    const output = formatInboxSetupGuide(guide);

    expect(guide.readiness.mode).toBe("not_receiving");
    expect(output).toContain("Mode: not receiving");
    expect(output).toContain(
      "Make a receiving-ready domain available, then re-run:",
    );
    expect(output).toContain("primitive inbox status");
    expect(output).not.toContain("primitive functions init inbound-reply");
  });
});

describe("inbox setup command invocation", () => {
  beforeEach(() => {
    previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
    tempConfigHome = mkdtempSync(join(tmpdir(), "primitive-inbox-setup-"));
    process.env.XDG_CONFIG_HOME = tempConfigHome;
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: { host: "primary" } },
      auth: { kind: "api-key" },
      baseUrlOverridden: false,
    });
  });

  afterEach(() => {
    process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
    rmSync(tempConfigHome, { force: true, recursive: true });
  });

  it("fetches status through the existing client and prints JSON metadata", async () => {
    mocks.getInboxStatus.mockResolvedValue({
      data: { data: makeStatus(), success: true },
    });

    const result = await runInboxSetupCommand(["--json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(mocks.createAuthenticatedCliApiClient).toHaveBeenCalled();
    expect(mocks.getInboxStatus).toHaveBeenCalledWith({
      client: { host: "primary" },
      responseStyle: "fields",
    });
    expect(parsed.data.readiness).toMatchObject({
      mode: "stored_only",
      receiving_ready: true,
      processing_ready: false,
    });
    expect(parsed.data.receive.address).toBe("inbox@long-ape.primitive.email");
    expect(parsed.data.commands.scaffold).toContain(
      "primitive functions init inbound-reply",
    );
    expect(parsed.data.proof.after_test).toContain(
      "inbound id for the generated test email",
    );
  });
});
