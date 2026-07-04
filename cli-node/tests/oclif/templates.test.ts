import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getTemplate: vi.fn(),
  getTemplateInstall: vi.fn(),
  installTemplate: vi.fn(),
  listTemplates: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getTemplate: mocks.getTemplate,
    getTemplateInstall: mocks.getTemplateInstall,
    installTemplate: mocks.installTemplate,
    listTemplates: mocks.listTemplates,
    operations: {
      ...actual.operations,
      getTemplate: mocks.getTemplate,
      getTemplateInstall: mocks.getTemplateInstall,
      installTemplate: mocks.installTemplate,
      listTemplates: mocks.listTemplates,
    },
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const TEMPLATE_SLUG = "reply-bot";
const INSTALL_ID = "11111111-1111-4111-8111-111111111111";

type RunnableTemplateCommand = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

function templateCommand(id: string): RunnableTemplateCommand {
  const command = COMMANDS[id] as unknown as
    | RunnableTemplateCommand
    | undefined;
  if (!command) throw new Error(`Missing command ${id}`);
  return command;
}

async function runTemplateCommand(
  command: RunnableTemplateCommand,
  argv: string[],
): Promise<{
  exitCode: NodeJS.Process["exitCode"];
  stdout: string;
  stderr: string;
}> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdoutChunks.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    });

  try {
    await command.run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: { host: "api" } },
    auth: { kind: "api-key" },
    baseUrlOverridden: false,
  });
  mocks.listTemplates.mockResolvedValue({
    data: {
      data: {
        items: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            slug: TEMPLATE_SLUG,
            title: "Reply Bot",
            summary: "Replies to inbound mail",
            author: { id: "primitive", name: "Primitive" },
            tags: ["email"],
            verified: true,
            install_count: 3,
            github_repo: "primitive/templates",
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
          },
        ],
        next_cursor: null,
      },
    },
  });
  mocks.getTemplate.mockResolvedValue({
    data: {
      data: {
        id: "22222222-2222-4222-8222-222222222222",
        slug: TEMPLATE_SLUG,
        title: "Reply Bot",
        summary: "Replies to inbound mail",
        description: null,
        author: { id: "primitive", name: "Primitive" },
        tags: ["email"],
        verified: true,
        install_count: 3,
        github_repo: "primitive/templates",
        github_sha: "abc123",
        github_path: null,
        manifest: {
          schemaVersion: 1,
          id: TEMPLATE_SLUG,
          title: "Reply Bot",
          summary: "Replies to inbound mail",
          author: { id: "primitive", name: "Primitive" },
          tags: ["email"],
          source: { mode: "managed-build", dir: "." },
          install: { mode: "deploy", editFiles: [], reason: "" },
          secrets: [],
          secretGroups: [],
          variables: [],
        },
        readme: null,
        status: "approved",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    },
  });
  mocks.installTemplate.mockResolvedValue({
    data: {
      data: {
        id: INSTALL_ID,
        template_slug: TEMPLATE_SLUG,
        state: "deploying",
        address: "reply@example.com",
        function_id: null,
        error: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    },
  });
  mocks.getTemplateInstall.mockResolvedValue({
    data: {
      data: {
        id: INSTALL_ID,
        template_slug: TEMPLATE_SLUG,
        state: "tested",
        address: "reply@example.com",
        function_id: "33333333-3333-4333-8333-333333333333",
        error: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    },
  });
});

describe("templates command registration", () => {
  it.each([
    "templates:list-templates",
    "templates:get-template",
    "templates:install-template",
    "templates:get-template-install",
  ])("registers %s", (id) => {
    expect(COMMANDS[id]).toBeDefined();
  });
});

describe("templates black-box command invocation", () => {
  it("runs list/get/install/status with the user-facing command shapes", async () => {
    await expect(
      runTemplateCommand(templateCommand("templates:list-templates"), [
        "--q",
        "reply",
        "--tag",
        "email",
        "--limit",
        "25",
        "--cursor",
        "next-page",
      ]),
    ).resolves.toMatchObject({ exitCode: undefined });
    expect(mocks.listTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { host: "api" },
        query: {
          q: "reply",
          tag: "email",
          limit: 25,
          cursor: "next-page",
        },
      }),
    );

    await expect(
      runTemplateCommand(templateCommand("templates:get-template"), [
        "--id",
        TEMPLATE_SLUG,
      ]),
    ).resolves.toMatchObject({ exitCode: undefined });
    expect(mocks.getTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { host: "api" },
        path: { id: TEMPLATE_SLUG },
      }),
    );

    await expect(
      runTemplateCommand(templateCommand("templates:install-template"), [
        "--id",
        TEMPLATE_SLUG,
        "--address",
        "reply",
        "--domain",
        "example.com",
        "--raw-body",
        JSON.stringify({
          secrets: { ANTHROPIC_API_KEY: "sk-test" },
          variables: { TONE: "brief" },
        }),
      ]),
    ).resolves.toMatchObject({ exitCode: undefined });
    expect(mocks.installTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          address: "reply",
          domain: "example.com",
          secrets: { ANTHROPIC_API_KEY: "sk-test" },
          variables: { TONE: "brief" },
        },
        client: { host: "api" },
        path: { id: TEMPLATE_SLUG },
      }),
    );

    await expect(
      runTemplateCommand(templateCommand("templates:get-template-install"), [
        "--id",
        INSTALL_ID,
      ]),
    ).resolves.toMatchObject({ exitCode: undefined });
    expect(mocks.getTemplateInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { host: "api" },
        path: { id: INSTALL_ID },
      }),
    );
  });
});
