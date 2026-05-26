import { describe, expect, it } from "vitest";
import { COMMANDS, lookupOperation } from "../../src/oclif/index.js";

describe("describe command", () => {
  it("registers `describe` in the COMMANDS map", () => {
    expect(COMMANDS.describe).toBeDefined();
  });

  it("registers browser login commands in the COMMANDS map", () => {
    expect(COMMANDS.login).toBeDefined();
    expect(COMMANDS["login:browser"]).toBeDefined();
    expect(COMMANDS["login:confirm"]).toBeDefined();
    expect(COMMANDS["login:resend"]).toBeDefined();
    expect(COMMANDS.otp).toBeDefined();
    expect(COMMANDS["otp:confirm"]).toBeDefined();
    expect(COMMANDS["otp:resend"]).toBeDefined();
    expect(COMMANDS.logout).toBeDefined();
  });

  it("registers existing-account sign-in commands in the COMMANDS map", () => {
    expect(COMMANDS.signin).toBeDefined();
    expect(COMMANDS["signin:browser"]).toBeDefined();
    expect(COMMANDS["signin:confirm"]).toBeDefined();
    expect(COMMANDS["signin:otp"]).toBeDefined();
    expect(COMMANDS["signin:otp:confirm"]).toBeDefined();
    expect(COMMANDS["signin:otp:resend"]).toBeDefined();
    expect(COMMANDS["signin:resend"]).toBeDefined();
  });
});

describe("lookupOperation", () => {
  it("finds a known operation by colon id", () => {
    const { match, candidates } = lookupOperation("emails:get-email");
    expect(match?.command).toBe("get-email");
    expect(match?.tagCommand).toBe("emails");
    expect(match?.path).toBe("/emails/{id}");
    expect(candidates).toEqual([]);
  });

  it("trims whitespace around the input", () => {
    const { match } = lookupOperation("  emails:get-email  ");
    expect(match?.command).toBe("get-email");
  });

  it("resolves canonical operation aliases", () => {
    const { match, candidates } = lookupOperation("emails:list");
    expect(match?.command).toBe("list-emails");
    expect(match?.tagCommand).toBe("emails");
    expect(candidates).toEqual([]);
  });

  it("resolves API operation-style names", () => {
    const add = lookupOperation("addDomain");
    expect(add.match?.command).toBe("add-domain");
    expect(add.match?.tagCommand).toBe("domains");
    expect(add.candidates).toEqual([]);

    const verify = lookupOperation("verifyDomain");
    expect(verify.match?.command).toBe("verify-domain");
    expect(verify.match?.tagCommand).toBe("domains");
    expect(verify.candidates).toEqual([]);
  });

  it("resolves tagged API operation-style names", () => {
    const { match, candidates } = lookupOperation("domains:addDomain");
    expect(match?.command).toBe("add-domain");
    expect(match?.tagCommand).toBe("domains");
    expect(candidates).toEqual([]);
  });

  it("resolves the zone-file shortcut to the download operation", () => {
    const { match, candidates } = lookupOperation("domains:zone-file");
    expect(match?.command).toBe("download-domain-zone-file");
    expect(match?.operationId).toBe("downloadDomainZoneFile");
    expect(candidates).toEqual([]);
  });

  it("resolves the top-level reply shortcut to the reply operation", () => {
    const { match } = lookupOperation("reply");
    expect(match?.command).toBe("reply-to-email");
    expect(match?.tagCommand).toBe("sending");
  });

  it("returns null match plus did-you-mean candidates for a typo", () => {
    const { match, candidates } = lookupOperation("emails:get-emial");
    expect(match).toBeNull();
    expect(candidates.length).toBeGreaterThan(0);
    // The closest real command should be one of the suggestions.
    expect(candidates).toContain("emails:get-email");
  });

  it("returns useful did-you-mean candidates for nearby domain operations", () => {
    const { match, candidates } = lookupOperation("domains:verifyDomian");
    expect(match).toBeNull();
    expect(candidates).toContain("domains:verify-domain");
  });

  it("returns at most 5 candidates", () => {
    const { candidates } = lookupOperation("list");
    expect(candidates.length).toBeLessThanOrEqual(5);
  });

  it("returns empty candidates when nothing resembles the input", () => {
    const { match, candidates } = lookupOperation("zzzzzz:notarealoperation");
    expect(match).toBeNull();
    expect(candidates).toEqual([]);
  });

  it("finds a unique bare generated command name", () => {
    const { match, candidates } = lookupOperation("get-email");
    expect(match?.command).toBe("get-email");
    expect(match?.tagCommand).toBe("emails");
    expect(candidates).toEqual([]);
  });
});
