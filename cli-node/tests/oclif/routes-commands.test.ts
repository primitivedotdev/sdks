import { describe, expect, it } from "vitest";
import RoutesAddCommand, {
  resolveCreateTarget,
} from "../../src/oclif/commands/routes-add.js";
import RoutesReorderCommand, {
  parseReorderUpdates,
} from "../../src/oclif/commands/routes-reorder.js";
import RoutesTestCommand from "../../src/oclif/commands/routes-test.js";
import RoutesUpdateCommand, {
  buildUpdateBody,
} from "../../src/oclif/commands/routes-update.js";
import { COMMANDS } from "../../src/oclif/index.js";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("routes commands: registration", () => {
  // The CLI uses an explicit COMMANDS registry; a command file that is not
  // listed there is unreachable ("command not found") despite existing. Guard
  // every routes verb so an unregistered command can never ship again.
  it.each([
    "routes:add",
    "routes:list",
    "routes:test",
    "routes:update",
    "routes:reorder",
    "routes:remove",
  ])("registers %s in the COMMANDS map", (key) => {
    expect(COMMANDS[key]).toBeDefined();
  });
});

describe("routes add: resolveCreateTarget", () => {
  it("routes to a function when --function is set", () => {
    expect(resolveCreateTarget({ function: ID_A })).toEqual({
      function_id: ID_A,
    });
  });

  it("routes to an endpoint when --endpoint is set", () => {
    expect(resolveCreateTarget({ endpoint: ID_A })).toEqual({
      endpoint_id: ID_A,
    });
  });

  it("errors when neither --function nor --endpoint is provided", () => {
    const result = resolveCreateTarget({});
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("--function");
      expect(result.error).toContain("--endpoint");
    }
  });

  it("prefers --function if both are somehow present (oclif rejects this earlier)", () => {
    expect(resolveCreateTarget({ function: ID_A, endpoint: ID_B })).toEqual({
      function_id: ID_A,
    });
  });
});

describe("routes add: command metadata", () => {
  it("makes --function and --endpoint mutually exclusive", () => {
    expect(RoutesAddCommand.flags.function.exclusive).toContain("endpoint");
    expect(RoutesAddCommand.flags.endpoint.exclusive).toContain("function");
  });

  it("exposes exact, wildcard, and regex match types", () => {
    expect(RoutesAddCommand.flags.match.options).toEqual([
      "exact",
      "wildcard",
      "regex",
    ]);
  });
});

describe("routes update: buildUpdateBody", () => {
  it("maps each provided field to its API key", () => {
    expect(
      buildUpdateBody({
        match: "wildcard",
        pattern: "alice@acme.com",
        endpoint: ID_A,
        domain: ID_B,
        priority: 7,
      }),
    ).toEqual({
      match_type: "wildcard",
      pattern: "alice@acme.com",
      endpoint_id: ID_A,
      domain_id: ID_B,
      priority: 7,
    });
  });

  it("translates --enable to enabled: true", () => {
    expect(buildUpdateBody({ enable: true })).toEqual({ enabled: true });
  });

  it("translates --disable to enabled: false", () => {
    expect(buildUpdateBody({ disable: true })).toEqual({ enabled: false });
  });

  it("includes priority 0 (not dropped as falsy)", () => {
    expect(buildUpdateBody({ priority: 0 })).toEqual({ priority: 0 });
  });

  it("returns an empty object when no fields are provided (drives the 'at least one field' guard)", () => {
    expect(buildUpdateBody({})).toEqual({});
  });

  it("makes --enable and --disable mutually exclusive", () => {
    expect(RoutesUpdateCommand.flags.enable.exclusive).toContain("disable");
    expect(RoutesUpdateCommand.flags.disable.exclusive).toContain("enable");
  });
});

describe("routes reorder: parseReorderUpdates", () => {
  it("parses a single id=priority pair", () => {
    expect(parseReorderUpdates([`${ID_A}=10`])).toEqual({
      updates: [{ id: ID_A, priority: 10 }],
    });
  });

  it("parses multiple pairs", () => {
    expect(parseReorderUpdates([`${ID_A}=10`, `${ID_B}=20`])).toEqual({
      updates: [
        { id: ID_A, priority: 10 },
        { id: ID_B, priority: 20 },
      ],
    });
  });

  it("accepts priority 0", () => {
    expect(parseReorderUpdates([`${ID_A}=0`])).toEqual({
      updates: [{ id: ID_A, priority: 0 }],
    });
  });

  it("rejects a pair with no '='", () => {
    const result = parseReorderUpdates([ID_A]);
    expect("error" in result).toBe(true);
  });

  it("rejects an empty id", () => {
    const result = parseReorderUpdates(["=10"]);
    expect("error" in result).toBe(true);
  });

  it("rejects a non-integer priority", () => {
    const result = parseReorderUpdates([`${ID_A}=abc`]);
    expect("error" in result).toBe(true);
  });

  it("rejects a negative priority", () => {
    const result = parseReorderUpdates([`${ID_A}=-5`]);
    expect("error" in result).toBe(true);
  });

  it("rejects the same route id appearing more than once", () => {
    const result = parseReorderUpdates([`${ID_A}=10`, `${ID_A}=20`]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("more than once");
    }
  });

  it("requires the --set flag", () => {
    expect(RoutesReorderCommand.flags.set.required).toBe(true);
    expect(RoutesReorderCommand.flags.set.multiple).toBe(true);
  });
});

describe("routes test: command metadata", () => {
  it("accepts an --event-type flag for modelling non-received events", () => {
    expect(RoutesTestCommand.flags["event-type"]).toBeDefined();
  });
});
