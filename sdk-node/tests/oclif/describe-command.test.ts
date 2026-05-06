import { describe, expect, it } from "vitest";
import { COMMANDS, lookupOperation } from "../../src/oclif/index.js";

describe("describe command", () => {
  it("registers `describe` in the COMMANDS map", () => {
    expect(COMMANDS.describe).toBeDefined();
  });

  it("registers browser login commands in the COMMANDS map", () => {
    expect(COMMANDS.login).toBeDefined();
    expect(COMMANDS.logout).toBeDefined();
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

  it("returns null match plus did-you-mean candidates for a typo", () => {
    const { match, candidates } = lookupOperation("emails:get-emial");
    expect(match).toBeNull();
    expect(candidates.length).toBeGreaterThan(0);
    // The closest real command should be one of the suggestions.
    expect(candidates).toContain("emails:get-email");
  });

  it("returns at most 5 candidates", () => {
    // A query that matches almost everything (every command name
    // contains a vowel; here we use a topic substring guaranteed to
    // hit several entries) should still cap suggestions at 5.
    const { candidates } = lookupOperation("e:e");
    expect(candidates.length).toBeLessThanOrEqual(5);
  });

  it("returns empty candidates when nothing resembles the input", () => {
    const { match, candidates } = lookupOperation("zzzzzz:notarealoperation");
    expect(match).toBeNull();
    expect(candidates).toEqual([]);
  });

  it("treats a bare id as topic-less (tag empty, command bare)", () => {
    // The lookup logic splits at the first colon and treats absence
    // as tag=''. No current operation has an empty tag, so this
    // should miss with no candidates by the topic-substring rule
    // (since '' is a substring of every tagCommand, every entry
    // matches and we get the first 5 alphabetically).
    const { match, candidates } = lookupOperation("get-email");
    expect(match).toBeNull();
    // Candidates exist because the empty-tag substring matches
    // every operation; verify we still capped at 5.
    expect(candidates.length).toBeLessThanOrEqual(5);
  });
});
