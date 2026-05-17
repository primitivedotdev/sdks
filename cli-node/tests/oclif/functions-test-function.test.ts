import { describe, expect, it } from "vitest";
import FunctionsTestFunctionCommand, {
  buildFunctionTestOutcome,
  findMatchingFunctionEndpoints,
  formatFunctionEndpointNoiseWarning,
} from "../../src/oclif/commands/functions-test-function.js";
import { COMMANDS } from "../../src/oclif/index.js";

// Smoke tests for the hand-rolled functions:test-function command.
// Verifies that the override is registered (so the auto-generated
// wrapper does not shadow it) and that the expected --wait /
// --show-sends / --timeout flags are present. The polling behavior
// itself is exercised via the existing emails-poll helpers, which
// have their own coverage in emails-poll.test.ts.

describe("functions:test-function command registration", () => {
  it("registers the hand-rolled command at the functions:test-function id", () => {
    expect(COMMANDS["functions:test-function"]).toBe(
      FunctionsTestFunctionCommand,
    );
  });

  it("exposes the --wait flag described as blocking", () => {
    const flags = FunctionsTestFunctionCommand.flags as Record<
      string,
      { description?: string }
    >;
    expect(flags.wait).toBeDefined();
    expect(flags.wait.description).toMatch(/block/i);
  });

  it("exposes the --show-sends flag that implies --wait", () => {
    const flags = FunctionsTestFunctionCommand.flags as Record<
      string,
      { description?: string }
    >;
    expect(flags["show-sends"]).toBeDefined();
    expect(flags["show-sends"].description).toMatch(/--wait|imply|implies/i);
  });

  it("exposes the --timeout flag with a sane default", () => {
    const flags = FunctionsTestFunctionCommand.flags as Record<
      string,
      { default?: number }
    >;
    expect(flags.timeout).toBeDefined();
    expect(typeof flags.timeout.default).toBe("number");
    expect(flags.timeout.default).toBeGreaterThan(0);
  });

  it("requires --id", () => {
    const flags = FunctionsTestFunctionCommand.flags as Record<
      string,
      { required?: boolean }
    >;
    expect(flags.id.required).toBe(true);
  });

  it("includes the wait + show-sends combo in static examples", () => {
    const examples = FunctionsTestFunctionCommand.examples as string[];
    const joined = examples.join("\n");
    expect(joined).toMatch(/--wait/);
    expect(joined).toMatch(/--show-sends/);
  });
});

describe("buildFunctionTestOutcome", () => {
  const BASE_INVOCATION = {
    from: "test@primitive.email",
    inbound_domain: "long-ape.primitive.email",
    poll_since: "2026-05-17T19:00:00.000Z",
    send_id: "send-1",
    subject: "Primitive Functions test invocation (summarize)",
    to: "summarize@long-ape.primitive.email",
    watch_url: "/app/functions/fn-1?tab=invocations",
  } as Parameters<typeof buildFunctionTestOutcome>[0]["invocation"];

  const BASE_DETAIL = {
    replies: [{ id: "reply-1", status: "delivered" }],
    webhook_attempt_count: 1,
    webhook_last_error: null,
    webhook_last_status_code: 200,
    webhook_status: "fired",
  } as Parameters<typeof buildFunctionTestOutcome>[0]["detail"];

  it("includes run-correlation fields that are known before polling", () => {
    const outcome = buildFunctionTestOutcome({
      detail: BASE_DETAIL,
      elapsedSeconds: 4,
      functionId: "fn-1",
      inboundId: "inbound-1",
      invocation: BASE_INVOCATION,
      showSends: true,
    });

    expect(outcome).toMatchObject({
      elapsed_seconds: 4,
      function_id: "fn-1",
      inbound_domain: "long-ape.primitive.email",
      inbound_id: "inbound-1",
      inbound_to: "summarize@long-ape.primitive.email",
      poll_since: "2026-05-17T19:00:00.000Z",
      test_send_id: "send-1",
      test_subject: "Primitive Functions test invocation (summarize)",
      watch_url: "/app/functions/fn-1?tab=invocations",
      webhook_attempt_count: 1,
      webhook_last_error: null,
      webhook_last_status_code: 200,
      webhook_status: "fired",
    });
    expect(outcome.sent_emails).toEqual([
      { id: "reply-1", status: "delivered" },
    ]);
  });

  it("omits sent_emails unless --show-sends was requested", () => {
    const outcome = buildFunctionTestOutcome({
      detail: BASE_DETAIL,
      elapsedSeconds: 4,
      functionId: "fn-1",
      inboundId: "inbound-1",
      invocation: BASE_INVOCATION,
      showSends: false,
    });

    expect(outcome).not.toHaveProperty("sent_emails");
  });
});

describe("function endpoint noise warnings", () => {
  it("matches catch-all and same-domain function endpoints", () => {
    const endpoints = findMatchingFunctionEndpoints({
      currentFunctionId: "fn-current",
      inboundDomainId: "domain-1",
      endpoints: [
        {
          domain_id: "domain-1",
          enabled: true,
          function_id: "fn-current",
          id: "endpoint-current",
          kind: "function",
        },
        {
          domain_id: null,
          enabled: true,
          function_id: "fn-catchall",
          id: "endpoint-catchall",
          kind: "function",
        },
        {
          domain_id: "domain-2",
          enabled: true,
          function_id: "fn-other-domain",
          id: "endpoint-other-domain",
          kind: "function",
        },
        {
          domain_id: null,
          enabled: true,
          function_id: "fn-http",
          id: "endpoint-http",
          kind: "http",
        },
        {
          domain_id: null,
          enabled: false,
          function_id: "fn-disabled",
          id: "endpoint-disabled",
          kind: "function",
        },
      ],
    });

    expect(endpoints).toEqual([
      {
        function_id: "fn-current",
        id: "endpoint-current",
        is_current_function: true,
        scope: "domain",
      },
      {
        function_id: "fn-catchall",
        id: "endpoint-catchall",
        is_current_function: false,
        scope: "catch-all",
      },
    ]);
  });

  it("formats a warning only when another function endpoint matches", () => {
    expect(
      formatFunctionEndpointNoiseWarning({
        endpoints: [
          {
            function_id: "fn-current",
            id: "endpoint-current",
            is_current_function: true,
            scope: "domain",
          },
        ],
        inboundDomain: "long-ape.primitive.email",
        toAddress: "summarize@long-ape.primitive.email",
      }),
    ).toBeNull();

    const warning = formatFunctionEndpointNoiseWarning({
      endpoints: [
        {
          function_id: "fn-current",
          id: "endpoint-current",
          is_current_function: true,
          scope: "domain",
        },
        {
          function_id: "fn-catchall",
          id: "endpoint-catchall",
          is_current_function: false,
          scope: "catch-all",
        },
      ],
      inboundDomain: "long-ape.primitive.email",
      toAddress: "summarize@long-ape.primitive.email",
    });

    expect(warning).toContain(
      "Warning: 2 function endpoints may receive mail for summarize@long-ape.primitive.email",
    );
    expect(warning).toContain("endpoint-current");
    expect(warning).toContain("this function");
    expect(warning).toContain("endpoint-catchall");
    expect(warning).toContain("catch-all");
  });
});
