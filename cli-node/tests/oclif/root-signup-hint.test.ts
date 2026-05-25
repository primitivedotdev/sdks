import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loggedOutSignupHint,
  shouldShowLoggedOutSignupHint,
  writeLoggedOutSignupHintIfNeeded,
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
      "primitive signup <email> --signup-code <invite-code> --accept-terms",
    );
    expect(loggedOutSignupHint()).toMatch(/^New to Primitive\?/);
  });
});
