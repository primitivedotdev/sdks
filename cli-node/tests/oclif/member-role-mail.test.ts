import { describe, expect, it } from "vitest";
import {
  inviteRefusalHint,
  MEMBER_INVITE_READS_ALL_MAIL,
  roleReadsAllMailWarning,
} from "../../src/oclif/member-role-mail.js";

const ROLES = {
  roles: [
    {
      id: "r-member",
      key: "member",
      kind: "builtin",
      name: "Member",
      mail_scope: "org",
    },
    {
      id: "r-admin",
      key: "admin",
      kind: "builtin",
      name: "Admin",
      mail_scope: "org",
    },
    {
      id: "r-own",
      key: "own_mail_read_only",
      kind: "template",
      name: "Read only (own mail)",
      mail_scope: { self: true, depth: "raw" },
    },
    {
      id: "8f8f8f8f-0000-4000-8000-000000000001",
      key: "support",
      kind: "custom",
      name: "Support",
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
      inviteRefusalHint("grant_forbidden", {
        email: "a@example.test",
        role: "member",
      }),
    ).toBe(MEMBER_INVITE_READS_ALL_MAIL);
    expect(MEMBER_INVITE_READS_ALL_MAIL).toContain(
      "every Member reads all of the organization's mail",
    );
    expect(MEMBER_INVITE_READS_ALL_MAIL).toContain("--role none");
  });

  it("says nothing for another role or another refusal", () => {
    expect(
      inviteRefusalHint("grant_forbidden", { role: "admin" }),
    ).toBeUndefined();
    expect(
      inviteRefusalHint("grant_forbidden", { role: "none" }),
    ).toBeUndefined();
    expect(inviteRefusalHint("forbidden", { role: "member" })).toBeUndefined();
    expect(inviteRefusalHint(undefined, {})).toBeUndefined();
  });
});

describe("roleReadsAllMailWarning", () => {
  it("warns for a role that reads every mailbox, by key or by id, while members read all mail", () => {
    expect(roleReadsAllMailWarning("member", ROLES)).toBe(
      "Warning: Member reads all of this organization's mail while it uses whole-organization access, so the person given it reads every mailbox. To give them only their own mail, choose a narrower role (see `primitive roles list`).",
    );
    expect(
      roleReadsAllMailWarning("8f8f8f8f-0000-4000-8000-000000000001", ROLES),
    ).toContain("Warning: Support reads all of this organization's mail");
  });

  it("says nothing for a narrower role, an unknown one, under delegated access, or when the roles cannot be read", () => {
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
    expect(
      roleReadsAllMailWarning("member", { roles: ROLES.roles }),
    ).toBeNull();
    expect(roleReadsAllMailWarning("member", null)).toBeNull();
  });
});
