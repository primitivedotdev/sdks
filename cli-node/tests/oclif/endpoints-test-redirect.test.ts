import { describe, expect, it } from "vitest";
import {
  detectFunctionEndpoint,
  formatFunctionEndpointRedirect,
  type ListEndpointsFn,
  maybeWriteFunctionEndpointRedirect,
} from "../../src/oclif/endpoints-test-redirect.js";

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111";
const FUNCTION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ENDPOINT_ID = "33333333-3333-4333-8333-333333333333";

// Build a `listEndpoints`-shaped fake from a plain rows array. The
// helper consumes `{ data: { data: rows } }` so we wrap accordingly.
// Returning a function rather than a static object so each test can
// also pass an explicit override (rejecting fn, error envelope, etc.).
function listOk(rows: Array<Record<string, unknown>>): ListEndpointsFn {
  return async () => ({ data: { data: rows } });
}

describe("detectFunctionEndpoint", () => {
  it("returns the matching endpoint + function ids for a function-kind row", async () => {
    const list = listOk([
      {
        id: ENDPOINT_ID,
        kind: "function",
        function_id: FUNCTION_ID,
        url: null,
      },
    ]);

    const match = await detectFunctionEndpoint(ENDPOINT_ID, list);

    expect(match).toEqual({
      endpointId: ENDPOINT_ID,
      functionId: FUNCTION_ID,
    });
  });

  it("returns null when the id matches an http-kind row", async () => {
    // The original `not_found` was a real not_found (e.g. wrong id,
    // wrong org); the dispatcher should keep the original envelope
    // and not invent a misleading function-redirect.
    const list = listOk([
      {
        id: ENDPOINT_ID,
        kind: "http",
        url: "https://example.test/hook",
      },
    ]);

    expect(await detectFunctionEndpoint(ENDPOINT_ID, list)).toBeNull();
  });

  it("returns null when the id is not in the list at all", async () => {
    const list = listOk([
      {
        id: OTHER_ENDPOINT_ID,
        kind: "function",
        function_id: FUNCTION_ID,
        url: null,
      },
    ]);

    expect(await detectFunctionEndpoint(ENDPOINT_ID, list)).toBeNull();
  });

  it("returns null when the list call returns an error envelope", async () => {
    const list: ListEndpointsFn = async () => ({
      error: { code: "unauthorized", message: "nope" },
    });

    expect(await detectFunctionEndpoint(ENDPOINT_ID, list)).toBeNull();
  });

  it("returns null when the list call throws", async () => {
    const list: ListEndpointsFn = async () => {
      throw new Error("fetch failed");
    };

    expect(await detectFunctionEndpoint(ENDPOINT_ID, list)).toBeNull();
  });

  it("returns null when the response has no rows array", async () => {
    const list: ListEndpointsFn = async () => ({ data: null });

    expect(await detectFunctionEndpoint(ENDPOINT_ID, list)).toBeNull();
  });

  it("returns null when the matching row is missing function_id", async () => {
    // Defensive: if the server ever returned kind=function without a
    // function_id, the redirect message would be useless. Skip rather
    // than surface a half-formed command.
    const list = listOk([
      {
        id: ENDPOINT_ID,
        kind: "function",
        url: null,
      },
    ]);

    expect(await detectFunctionEndpoint(ENDPOINT_ID, list)).toBeNull();
  });

  it("skips malformed rows and keeps scanning for the real match", async () => {
    const list = listOk([
      null as unknown as Record<string, unknown>,
      { id: 42 } as unknown as Record<string, unknown>,
      {
        id: ENDPOINT_ID,
        kind: "function",
        function_id: FUNCTION_ID,
        url: null,
      },
    ]);

    expect(await detectFunctionEndpoint(ENDPOINT_ID, list)).toEqual({
      endpointId: ENDPOINT_ID,
      functionId: FUNCTION_ID,
    });
  });
});

describe("formatFunctionEndpointRedirect", () => {
  it("includes the suggested functions:test command with the function id", async () => {
    const output = formatFunctionEndpointRedirect({
      endpointId: ENDPOINT_ID,
      functionId: FUNCTION_ID,
    });

    expect(output).toContain(`primitive functions test --id ${FUNCTION_ID}`);
  });

  it("surfaces both ids so the caller does not have to look up the function id", async () => {
    const output = formatFunctionEndpointRedirect({
      endpointId: ENDPOINT_ID,
      functionId: FUNCTION_ID,
    });

    expect(output).toContain(`endpoint_id=${ENDPOINT_ID}`);
    expect(output).toContain(`function_id=${FUNCTION_ID}`);
  });
});

describe("maybeWriteFunctionEndpointRedirect", () => {
  function functionEndpointList(): ListEndpointsFn {
    return listOk([
      {
        id: ENDPOINT_ID,
        kind: "function",
        function_id: FUNCTION_ID,
        url: null,
      },
    ]);
  }

  it("prints the redirect and returns the match when test-endpoint hits not_found on a function endpoint", async () => {
    const writes: string[] = [];

    const match = await maybeWriteFunctionEndpointRedirect({
      sdkName: "testEndpoint",
      errorCode: "not_found",
      endpointId: ENDPOINT_ID,
      listEndpoints: functionEndpointList(),
      writeStderr: (chunk) => writes.push(chunk),
    });

    expect(match).toEqual({
      endpointId: ENDPOINT_ID,
      functionId: FUNCTION_ID,
    });
    const stderr = writes.join("");
    expect(stderr).toContain(`primitive functions test --id ${FUNCTION_ID}`);
    expect(stderr).toContain(`endpoint_id=${ENDPOINT_ID}`);
    expect(stderr).toContain(`function_id=${FUNCTION_ID}`);
  });

  it("does not print or look up anything for an unrelated operation", async () => {
    // Sanity: every other sdkName flowing through the same error path
    // (e.g. updateEndpoint, listDomains) must NOT trigger a redirect
    // lookup. We assert by tracking whether listEndpoints was called.
    const writes: string[] = [];
    let listCalled = 0;
    const list: ListEndpointsFn = async () => {
      listCalled += 1;
      return { data: { data: [] } };
    };

    const match = await maybeWriteFunctionEndpointRedirect({
      sdkName: "updateEndpoint",
      errorCode: "not_found",
      endpointId: ENDPOINT_ID,
      listEndpoints: list,
      writeStderr: (chunk) => writes.push(chunk),
    });

    expect(match).toBeNull();
    expect(listCalled).toBe(0);
    expect(writes).toEqual([]);
  });

  it("does not print or look up anything for a non-not_found error", async () => {
    // `validation_error`, `unauthorized`, `rate_limited`, etc. are
    // unrelated to the function-endpoint id confusion. The original
    // envelope alone is the right response; we should not append a
    // misleading function-redirect hint.
    const writes: string[] = [];
    let listCalled = 0;
    const list: ListEndpointsFn = async () => {
      listCalled += 1;
      return { data: { data: [] } };
    };

    const match = await maybeWriteFunctionEndpointRedirect({
      sdkName: "testEndpoint",
      errorCode: "validation_error",
      endpointId: ENDPOINT_ID,
      listEndpoints: list,
      writeStderr: (chunk) => writes.push(chunk),
    });

    expect(match).toBeNull();
    expect(listCalled).toBe(0);
    expect(writes).toEqual([]);
  });

  it("does not call listEndpoints when no --id was provided", async () => {
    // Defensive: if the caller somehow reached test-endpoint without
    // an id (oclif would have rejected this earlier, but the hook
    // should still be safe), we should not blast through to
    // listEndpoints with no id to match on.
    const writes: string[] = [];
    let listCalled = 0;
    const list: ListEndpointsFn = async () => {
      listCalled += 1;
      return { data: { data: [] } };
    };

    const match = await maybeWriteFunctionEndpointRedirect({
      sdkName: "testEndpoint",
      errorCode: "not_found",
      endpointId: undefined,
      listEndpoints: list,
      writeStderr: (chunk) => writes.push(chunk),
    });

    expect(match).toBeNull();
    expect(listCalled).toBe(0);
    expect(writes).toEqual([]);
  });

  it("does not print anything when listEndpoints fails", async () => {
    // listEndpoints can fail for the same reason testEndpoint did
    // (network, auth, transient 5xx). In that case we have no
    // signal that the id belongs to a function endpoint, so we
    // keep the original error envelope and do not invent a hint.
    const writes: string[] = [];
    const list: ListEndpointsFn = async () => ({
      error: { code: "internal_error", message: "boom" },
    });

    const match = await maybeWriteFunctionEndpointRedirect({
      sdkName: "testEndpoint",
      errorCode: "not_found",
      endpointId: ENDPOINT_ID,
      listEndpoints: list,
      writeStderr: (chunk) => writes.push(chunk),
    });

    expect(match).toBeNull();
    expect(writes).toEqual([]);
  });

  it("does not print anything when the id matches a real http-kind endpoint", async () => {
    // The original `not_found` was a real not_found (deleted, wrong
    // id, etc.). The redirect would be misleading.
    const writes: string[] = [];

    const match = await maybeWriteFunctionEndpointRedirect({
      sdkName: "testEndpoint",
      errorCode: "not_found",
      endpointId: ENDPOINT_ID,
      listEndpoints: listOk([
        { id: ENDPOINT_ID, kind: "http", url: "https://example.test/hook" },
      ]),
      writeStderr: (chunk) => writes.push(chunk),
    });

    expect(match).toBeNull();
    expect(writes).toEqual([]);
  });
});
