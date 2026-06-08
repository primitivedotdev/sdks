import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loggedOutSignupHint,
  rootSignedInSummary,
  shouldShowLoggedOutSignupHint,
  writeLoggedOutSignupHintIfNeeded,
  writeRootAuthContextIfNeeded,
} from "../../src/oclif/root-signup-hint.js";

describe("root signup hint", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `primitive-cli-root-signup-hint-${process.pid}-${Date.now()}`,
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("shows on bare primitive when no auth source exists", () => {
    expect(
      shouldShowLoggedOutSignupHint({
        argv: [],
        env: { XDG_CONFIG_HOME: tempDir },
        home: tempDir,
      }),
    ).toBe(true);
  });

  it("does not show for real commands", () => {
    expect(
      shouldShowLoggedOutSignupHint({
        argv: ["send", "--help"],
        env: { XDG_CONFIG_HOME: tempDir },
        home: tempDir,
      }),
    ).toBe(false);
  });

  it("does not show when an explicit API key is available", () => {
    expect(
      shouldShowLoggedOutSignupHint({
        argv: [],
        env: { PRIMITIVE_API_KEY: "prim_test", XDG_CONFIG_HOME: tempDir },
        home: tempDir,
      }),
    ).toBe(false);
  });

  it("does not show when saved credentials exist", () => {
    const configDir = join(tempDir, "primitive");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "credentials.json"), "{}\n");

    expect(
      shouldShowLoggedOutSignupHint({
        argv: [],
        env: { XDG_CONFIG_HOME: tempDir },
        home: tempDir,
      }),
    ).toBe(false);
  });

  it("can be suppressed by environment variable", () => {
    expect(
      shouldShowLoggedOutSignupHint({
        argv: [],
        env: {
          PRIMITIVE_HIDE_SIGNUP_HINT: "1",
          XDG_CONFIG_HOME: tempDir,
        },
        home: tempDir,
      }),
    ).toBe(false);
  });

  it("writes the signup command near the top of root help", () => {
    const writes: string[] = [];

    writeLoggedOutSignupHintIfNeeded({
      argv: [],
      env: { XDG_CONFIG_HOME: tempDir },
      home: tempDir,
      write: (message) => writes.push(message),
    });

    expect(writes.join("")).toContain(
      "primitive signup <email> --accept-terms",
    );
    // The hint mentions the optional bonus code in a separate line so
    // a user who has one knows to pass it, but the primary suggestion
    // is the open-signup invocation.
    expect(writes.join("")).toContain("--signup-code <code>");
    expect(loggedOutSignupHint()).toMatch(/^New to Primitive\?/);
  });

  it("formats a signed-in account line on bare primitive", async () => {
    const configDir = join(tempDir, "primitive");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "credentials.json"),
      `${JSON.stringify({
        access_token: "prim_oat_root",
        api_base_url: "https://api.example.test/v1/",
        auth_method: "oauth",
      })}\n`,
    );

    const summary = await rootSignedInSummary({
      argv: [],
      env: { XDG_CONFIG_HOME: tempDir },
      fetch: async (input, init) => {
        expect(String(input)).toBe("https://api.example.test/v1/account");
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer prim_oat_root",
        );
        return Response.json({
          data: { email: "agent@example.com", id: "org_123" },
        });
      },
      home: tempDir,
      timeoutMs: 50,
    });

    expect(summary).toBe("Signed in as agent@example.com (org org_123)\n\n");
  });

  it("formats a signed-in account line from an explicit API key", async () => {
    const configDir = join(tempDir, "primitive");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "credentials.json"),
      `${JSON.stringify({
        access_token: "prim_oat_should_not_be_used",
        api_base_url: "https://stored.example.test/v1",
        auth_method: "oauth",
      })}\n`,
    );

    const summary = await rootSignedInSummary({
      argv: [],
      env: {
        PRIMITIVE_API_BASE_URL: "https://api-key.example.test/v1/",
        PRIMITIVE_API_KEY: "prim_explicit_root",
        XDG_CONFIG_HOME: tempDir,
      },
      fetch: async (input, init) => {
        expect(String(input)).toBe("https://api-key.example.test/v1/account");
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer prim_explicit_root",
        );
        return Response.json({
          data: { email: "api-key@example.com", id: "org_api_key" },
        });
      },
      home: tempDir,
      timeoutMs: 50,
    });

    expect(summary).toBe(
      "Signed in as api-key@example.com (org org_api_key)\n\n",
    );
  });

  it("does not fetch a signed-in account for subcommands", async () => {
    const summary = await rootSignedInSummary({
      argv: ["whoami"],
      env: { PRIMITIVE_API_KEY: "prim_test", XDG_CONFIG_HOME: tempDir },
      fetch: async () => {
        throw new Error("should not fetch");
      },
      home: tempDir,
    });

    expect(summary).toBeNull();
  });

  it("writes signed-in context instead of the logged-out signup hint", async () => {
    const configDir = join(tempDir, "primitive");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "credentials.json"),
      `${JSON.stringify({
        access_token: "prim_oat_root",
        api_base_url: "https://api.example.test/v1",
        auth_method: "oauth",
      })}\n`,
    );
    const writes: string[] = [];

    await writeRootAuthContextIfNeeded({
      argv: [],
      env: { XDG_CONFIG_HOME: tempDir },
      fetch: async () =>
        Response.json({
          data: { email: "agent@example.com", id: "org_123" },
        }),
      home: tempDir,
      timeoutMs: 50,
      write: (message) => writes.push(message),
    });

    expect(writes.join("")).toBe(
      "Signed in as agent@example.com (org org_123)\n\n",
    );
  });

  it("falls back to the signup hint when no signed-in account is available", async () => {
    const writes: string[] = [];

    await writeRootAuthContextIfNeeded({
      argv: [],
      env: { XDG_CONFIG_HOME: tempDir },
      home: tempDir,
      write: (message) => writes.push(message),
    });

    expect(writes.join("")).toContain("New to Primitive?");
  });
});
