import { describe, expect, it } from "vitest";
import FunctionsTestFunctionCommand, {
  buildFunctionTestOutcome,
  findMatchingFunctionEndpoints,
  formatFunctionEndpointNoiseWarning,
  writeFunctionTestProgress,
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
    test_run_id: "test-run-1",
    to: "summarize@long-ape.primitive.email",
    trace_url: "/api/v1/functions/fn-1/test-runs/test-run-1/trace",
    watch_url: "/app/functions/fn-1?tab=invocations",
  } as Parameters<typeof buildFunctionTestOutcome>[0]["invocation"];

  const BASE_TRACE = {
    deliveries: [],
    inbound_email: {
      from: "functions-test@primitive.email",
      id: "inbound-1",
      received_at: "2026-05-17T19:00:01.000Z",
      status: "accepted",
      subject: "Primitive Functions test invocation (summarize)",
      to: "summarize@long-ape.primitive.email",
      webhook_attempt_count: 1,
      webhook_last_error: null,
      webhook_last_status_code: 200,
      webhook_status: "fired",
    },
    logs: [],
    outbound_requests: [],
    replies: [
      {
        created_at: "2026-05-17T19:00:02.000Z",
        id: "reply-1",
        queue_id: "queue-1",
        status: "delivered",
        subject: "Re: Primitive Functions test invocation (summarize)",
        to: "functions-test@primitive.email",
      },
    ],
    state: "completed",
    test_run: {
      created_at: "2026-05-17T19:00:00.000Z",
      from: "test@primitive.email",
      function_id: "fn-1",
      id: "test-run-1",
      inbound_domain: "long-ape.primitive.email",
      poll_since: "2026-05-17T19:00:00.000Z",
      send_error: null,
      sent_at: "2026-05-17T19:00:00.500Z",
      subject: "Primitive Functions test invocation (summarize)",
      to: "summarize@long-ape.primitive.email",
    },
    test_send: {
      created_at: "2026-05-17T19:00:00.000Z",
      id: "send-1",
      queue_id: "queue-send",
      status: "delivered",
      updated_at: "2026-05-17T19:00:01.000Z",
    },
  } as Parameters<typeof buildFunctionTestOutcome>[0]["trace"];

  it("includes run-correlation fields that are known before polling", () => {
    const outcome = buildFunctionTestOutcome({
      elapsedSeconds: 4,
      functionId: "fn-1",
      invocation: BASE_INVOCATION,
      showSends: true,
      trace: BASE_TRACE,
    });

    expect(outcome).toMatchObject({
      elapsed_seconds: 4,
      function_id: "fn-1",
      inbound_domain: "long-ape.primitive.email",
      inbound_id: "inbound-1",
      inbound_to: "summarize@long-ape.primitive.email",
      poll_since: "2026-05-17T19:00:00.000Z",
      state: "completed",
      test_run_id: "test-run-1",
      test_send_id: "send-1",
      test_subject: "Primitive Functions test invocation (summarize)",
      trace_url: "/api/v1/functions/fn-1/test-runs/test-run-1/trace",
      watch_url: "/app/functions/fn-1?tab=invocations",
      webhook_attempt_count: 1,
      webhook_last_error: null,
      webhook_last_status_code: 200,
      webhook_status: "fired",
    });
    expect(outcome.sent_emails).toEqual(BASE_TRACE.replies);
  });

  it("omits sent_emails unless --show-sends was requested", () => {
    const outcome = buildFunctionTestOutcome({
      elapsedSeconds: 4,
      functionId: "fn-1",
      invocation: BASE_INVOCATION,
      showSends: false,
      trace: BASE_TRACE,
    });

    expect(outcome).not.toHaveProperty("sent_emails");
  });
});

describe("writeFunctionTestProgress", () => {
  it("writes progress lines to stderr so stdout can remain one JSON document", () => {
    const chunks: string[] = [];

    writeFunctionTestProgress(
      "Waiting for test inbound to arrive...",
      (chunk) => {
        chunks.push(chunk);
      },
    );

    expect(chunks).toEqual(["Waiting for test inbound to arrive...\n"]);
  });
});

describe("function endpoint noise warnings", () => {
  it("uses same-domain function endpoints and suppresses fallback endpoints", () => {
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
          deactivated_at: "2026-05-17T19:00:00.000Z",
          enabled: true,
          function_id: "fn-deactivated",
          id: "endpoint-deactivated",
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
    ]);
  });

  it("matches fallback function endpoints when no same-domain endpoint exists", () => {
    const endpoints = findMatchingFunctionEndpoints({
      currentFunctionId: "fn-current",
      inboundDomainId: "domain-1",
      endpoints: [
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
          function_id: "fn-current",
          id: "endpoint-current-fallback",
          kind: "function",
        },
        {
          domain_id: null,
          enabled: true,
          function_id: "fn-other-fallback",
          id: "endpoint-other-fallback",
          kind: "function",
        },
      ],
    });

    expect(endpoints).toEqual([
      {
        function_id: "fn-current",
        id: "endpoint-current-fallback",
        is_current_function: true,
        scope: "fallback",
      },
      {
        function_id: "fn-other-fallback",
        id: "endpoint-other-fallback",
        is_current_function: false,
        scope: "fallback",
      },
    ]);
  });

  it("matches only fallback function endpoints when the inbound domain id is unknown", () => {
    const endpoints = findMatchingFunctionEndpoints({
      currentFunctionId: "fn-current",
      inboundDomainId: null,
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
      ],
    });

    expect(endpoints).toEqual([
      {
        function_id: "fn-catchall",
        id: "endpoint-catchall",
        is_current_function: false,
        scope: "fallback",
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
          function_id: "fn-other-domain",
          id: "endpoint-other-domain",
          is_current_function: false,
          scope: "domain",
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
    expect(warning).toContain("endpoint-other-domain");
    expect(warning).toContain("scoped to long-ape.primitive.email");
  });

  it("formats fallback endpoint warnings using fallback terminology", () => {
    const warning = formatFunctionEndpointNoiseWarning({
      endpoints: [
        {
          function_id: "fn-current",
          id: "endpoint-current",
          is_current_function: true,
          scope: "fallback",
        },
        {
          function_id: "fn-other-fallback",
          id: "endpoint-other-fallback",
          is_current_function: false,
          scope: "fallback",
        },
      ],
      inboundDomain: "long-ape.primitive.email",
      toAddress: "summarize@long-ape.primitive.email",
    });

    expect(warning).toContain("endpoint-other-fallback");
    expect(warning).toContain("fallback");
    expect(warning).not.toContain("catch-all");
  });
});
