import { describe, expect, it } from "vitest";
import {
  orgSecretsAuthHeaders,
  orgSecretsUrl,
  runOrgSecretsRequest,
} from "../../src/oclif/commands/org-secrets-shared.js";
import { COMMANDS } from "../../src/oclif/index.js";

const BASE = "https://api.example.test/v1";
const HEADERS = { authorization: "Bearer k" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("orgSecretsUrl", () => {
  it("builds collection and item URLs and trims a trailing slash", () => {
    expect(orgSecretsUrl(BASE)).toBe("https://api.example.test/v1/org/secrets");
    expect(orgSecretsUrl(`${BASE}/`)).toBe(
      "https://api.example.test/v1/org/secrets",
    );
    expect(orgSecretsUrl(BASE, "MY_KEY")).toBe(
      "https://api.example.test/v1/org/secrets/MY_KEY",
    );
    expect(orgSecretsUrl(BASE, "a/b")).toContain("/org/secrets/a%2Fb");
  });
});

describe("orgSecretsAuthHeaders", () => {
  it("merges request headers with the bearer token", () => {
    expect(orgSecretsAuthHeaders({ "x-test": "1" }, "k")).toEqual({
      "x-test": "1",
      authorization: "Bearer k",
    });
    expect(orgSecretsAuthHeaders(undefined, undefined)).toEqual({});
  });
});

describe("runOrgSecretsRequest", () => {
  it("list GETs the collection and returns the items array", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push([String(url), init]);
      return jsonResponse({ success: true, data: { items: [{ key: "A" }] } });
    }) as unknown as typeof fetch;
    const out = await runOrgSecretsRequest(fetchImpl, BASE, HEADERS, {
      kind: "list",
    });
    expect(out).toEqual({ kind: "ok", data: [{ key: "A" }] });
    expect(calls[0]?.[0]).toBe("https://api.example.test/v1/org/secrets");
    expect(calls[0]?.[1]?.method).toBeUndefined();
  });

  it("set POSTs key+value as JSON and returns the upserted row", async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      captured = init;
      return jsonResponse({ success: true, data: { key: "K", created: true } });
    }) as unknown as typeof fetch;
    const out = await runOrgSecretsRequest(fetchImpl, BASE, HEADERS, {
      kind: "set",
      key: "K",
      value: "v",
    });
    expect(out).toEqual({ kind: "ok", data: { key: "K", created: true } });
    expect(captured?.method).toBe("POST");
    expect(JSON.parse(captured?.body as string)).toEqual({
      key: "K",
      value: "v",
    });
    expect((captured?.headers as Record<string, string>)["content-type"]).toBe(
      "application/json",
    );
  });

  it("remove DELETEs the keyed URL and returns null", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${url}`);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const out = await runOrgSecretsRequest(fetchImpl, BASE, HEADERS, {
      kind: "remove",
      key: "K",
    });
    expect(out).toEqual({ kind: "ok", data: null });
    expect(calls[0]).toBe("DELETE https://api.example.test/v1/org/secrets/K");
  });

  it("returns an error outcome on a non-2xx response", async () => {
    const fetchImpl = (async () =>
      jsonResponse(
        { success: false, error: { code: "validation_error", message: "bad" } },
        400,
      )) as unknown as typeof fetch;
    const out = await runOrgSecretsRequest(fetchImpl, BASE, HEADERS, {
      kind: "set",
      key: "bad",
      value: "v",
    });
    expect(out.kind).toBe("error");
  });

  it("returns an error outcome on a transport error", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    const out = await runOrgSecretsRequest(fetchImpl, BASE, HEADERS, {
      kind: "list",
    });
    expect(out.kind).toBe("error");
  });
});

describe("org secrets command registration", () => {
  it("registers list/set/remove under the org:secrets topic", () => {
    expect(COMMANDS["org:secrets:list"]).toBeDefined();
    expect(COMMANDS["org:secrets:set"]).toBeDefined();
    expect(COMMANDS["org:secrets:remove"]).toBeDefined();
  });
});
