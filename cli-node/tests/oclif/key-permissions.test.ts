import { describe, expect, it } from "vitest";
import {
  EVERY_MAILBOX_KEY_PERMISSIONS,
  KEY_PERMISSION_AREAS,
  keyPermissionsHelp,
  ungrantablePermission,
} from "../../src/oclif/key-permissions.js";

describe("the permissions a key can hold", () => {
  const all = [
    ...KEY_PERMISSION_AREAS.flatMap((area) => area.permissions),
    ...EVERY_MAILBOX_KEY_PERMISSIONS,
  ];

  it("names each permission once, each shaped like a permission", () => {
    expect(new Set(all).size).toBe(all.length);
    for (const permission of all) {
      expect(permission).toMatch(/^[a-z][a-z0-9_.]*:[a-z][a-z0-9_]*$/);
    }
    // The key builder's 54, and members:read for a key on every mailbox.
    expect(all).toHaveLength(55);
  });

  it("lists them by area in --help-full", () => {
    const help = keyPermissionsHelp();
    expect(help).toMatch(
      /^Permissions a key can hold, by area, as this CLI version lists them \(the API decides, and a key never holds more than you do\): Mail: mail:read, changes:read, /,
    );
    for (const permission of all) expect(help).toContain(permission);
    expect(help).toMatch(
      /Only a key that reaches every mailbox \(--all-mailboxes\) can also hold members:read\.$/,
    );
  });
});

describe("ungrantablePermission", () => {
  it("reads the permission out of the refusal", () => {
    expect(
      ungrantablePermission({
        code: "validation_error",
        message: "mail:everything cannot be granted to a key",
        details: {},
      }),
    ).toBe("mail:everything");
  });

  it("reads it from the whole error response too, and keeps a name with spaces", () => {
    expect(
      ungrantablePermission({
        success: false,
        error: {
          code: "validation_error",
          message: "mail:read mail:send cannot be granted to a key",
        },
      }),
    ).toBe("mail:read mail:send");
  });

  it("ignores any other refusal", () => {
    for (const payload of [
      { code: "validation_error", message: "Say which mail the key reaches." },
      {
        code: "grant_forbidden",
        message: "mail:everything cannot be granted to a key",
      },
      {
        code: "validation_error",
        message: "mail:everything cannot be granted to a Function",
      },
      { code: "validation_error" },
      null,
    ]) {
      expect(ungrantablePermission(payload)).toBeNull();
    }
  });
});
