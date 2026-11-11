import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  inviteRefusalHint,
  MEMBER_INVITE_READS_ALL_MAIL,
  readRoles,
  roleReadsAllMailWarning,
} from "../../src/oclif/member-role-mail.js";

const READS = ["mail:read", "mail:send"];
const ROLES = {
  roles: [
    {
      id: "r-member",
      key: "member",
      kind: "builtin",
      name: "Member",
      permissions: READS,
      mail_scope: "org",
    },
    {
      id: "r-admin",
      key: "admin",
      kind: "builtin",
      name: "Admin",
      permissions: READS,
      mail_scope: "org",
    },
    {
      id: "r-own",
      key: "own_mail_read_only",
      kind: "template",
      name: "Read only (own mail)",
      permissions: ["mail:read"],
      mail_scope: { self: true, depth: "raw" },
    },
    {
      id: "r-billing",
      key: "billing",
      kind: "template",
      name: "Billing",
      permissions: ["billing:manage"],
      mail_scope: "org",
    },
    {
      id: "8f8f8f8f-0000-4000-8000-000000000001",
      key: "support",
      kind: "custom",
      name: "Sup\u001b[2Kport\nLine",
      permissions: READS,
      mail_scope: "org",
    },
  ],
  templates: [
    {
      key: "read_only",
      name: "Read only",
      description: "Read mail.",
      permissions: ["mail:read"],
      mail_scope: "org",
    },
  ],
  invitations: { limited_roles_available: true, members_read_all_mail: true },
};

describe("inviteRefusalHint", () => {
  it("explains a refused invitation for Member, given or by default", () => {
    expect(
      inviteRefusalHint("grant_forbidden", { email: "a@example.test" }),
    ).toBe(MEMBER_INVITE_READS_ALL_MAIL);
    expect(
      inviteRefusalHint(
        "grant_forbidden",
        { email: "a@example.test", role: "member" },
        { code: "grant_forbidden", message: "m" },
      ),
    ).toBe(MEMBER_INVITE_READS_ALL_MAIL);
    expect(MEMBER_INVITE_READS_ALL_MAIL).toContain(
      "In this organization every Member reads all of its mail",
    );
    expect(MEMBER_INVITE_READS_ALL_MAIL).toContain("--role none");
  });

  it("says nothing for another role, another refusal, or one that names a missing permission", () => {
    expect(
      inviteRefusalHint("grant_forbidden", { role: "admin" }),
    ).toBeUndefined();
    expect(
      inviteRefusalHint("grant_forbidden", { role: "none" }),
    ).toBeUndefined();
    expect(inviteRefusalHint("forbidden", { role: "member" })).toBeUndefined();
    expect(inviteRefusalHint(undefined, {})).toBeUndefined();
    expect(
      inviteRefusalHint(
        "grant_forbidden",
        {},
        {
          code: "grant_forbidden",
          details: { permission: "invitations:manage" },
        },
      ),
    ).toBeUndefined();
  });
});

describe("roleReadsAllMailWarning", () => {
  it("warns for a role that reads every mailbox, by key or id in any case, while members read all mail", () => {
    expect(roleReadsAllMailWarning("member", ROLES)).toBe(
      "Warning: Member reads all of this organization's mail while this organization uses whole-organization access, so the person given it reads every mailbox. For only their own mail, use a narrower role: `primitive roles list --json` shows each role's mail_scope.",
    );
    expect(
      roleReadsAllMailWarning("8F8F8F8F-0000-4000-8000-000000000001", ROLES),
    ).toContain("Warning: Sup[2KportLine reads all");
  });

  it("warns for a template the organization has not copied yet, and when the answer does not say how mail is given", () => {
    expect(roleReadsAllMailWarning("read_only", ROLES)).toContain(
      "Warning: Read only reads all of this organization's mail",
    );
    const { invitations: _, ...unsaid } = ROLES;
    expect(roleReadsAllMailWarning("member", unsaid)).toContain(
      "Warning: Member reads all",
    );
  });

  it("says nothing for a role without mail:read, a narrower one, an unknown one, under delegated access, or when the roles cannot be read", () => {
    expect(roleReadsAllMailWarning("billing", ROLES)).toBeNull();
    expect(roleReadsAllMailWarning("own_mail_read_only", ROLES)).toBeNull();
    expect(roleReadsAllMailWarning("nope", ROLES)).toBeNull();
    expect(
      roleReadsAllMailWarning("member", {
        ...ROLES,
        invitations: {
          limited_roles_available: true,
          members_read_all_mail: false,
        },
      }),
    ).toBeNull();
    expect(roleReadsAllMailWarning("member", null)).toBeNull();
  });
});

describe("readRoles", () => {
  it("gives up on a roles read that does not answer in time", async () => {
    const hanging = new PrimitiveApiClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: ((input: Request) =>
        new Promise<Response>((_resolve, reject) => {
          input.signal.addEventListener("abort", () =>
            reject(input.signal.reason),
          );
        })) as typeof fetch,
    });
    const started = Date.now();
    expect(await readRoles(hanging.client, 50)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
