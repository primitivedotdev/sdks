import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgentContactsAdd from "../../src/oclif/commands/agent-contacts-add.js";
import AgentContactsList from "../../src/oclif/commands/agent-contacts-list.js";
import AgentContactsRemove from "../../src/oclif/commands/agent-contacts-remove.js";
import AgentContactsUpdate from "../../src/oclif/commands/agent-contacts-update.js";
import ContactsAdd from "../../src/oclif/commands/contacts-add.js";
import ContactsGet from "../../src/oclif/commands/contacts-get.js";
import ContactsList from "../../src/oclif/commands/contacts-list.js";
import ContactsRemove from "../../src/oclif/commands/contacts-remove.js";
import ContactsUpdate from "../../src/oclif/commands/contacts-update.js";
import {
  ContactsApiError,
  contactAgentAddress,
  runContactRequest,
} from "../../src/oclif/contacts.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));
const address = "peer+tag@example.test";
const agent = "agent@example.test";
const version = "00000000-0000-4000-8000-000000000001";
const newer = "00000000-0000-4000-8000-000000000002";
const contact = {
  address,
  display_name: "Existing label",
  version,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const member = {
  agent_address: agent,
  contact_address: address,
  purpose: "Existing purpose",
  notify: true,
  notify_since: "2026-01-01T00:00:00Z",
  notification_generation: newer,
  version,
  created_at: contact.created_at,
  updated_at: contact.updated_at,
};
const ok = (data: unknown, cursor?: string | null) => ({
  body: {
    success: true,
    data,
    ...(cursor === undefined ? {} : { meta: { cursor, limit: 100 } }),
  },
});
const conflict = {
  status: 409,
  body: {
    success: false,
    error: { code: "contact_conflict", message: "Version changed" },
  },
};
type Reply = { body: unknown; status?: number };
function fixture(...responses: Reply[]) {
  const calls: { method: string; url: URL; body: unknown }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init);
    const text = await request.text();
    calls.push({
      method: request.method,
      url: new URL(request.url),
      body: text ? JSON.parse(text) : undefined,
    });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected extra API request");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  const client = new PrimitiveApiClient({
    apiBaseUrl: "https://api.example.test/v1",
    fetch,
  });
  return { client: client.client, apiClient: client, calls, fetch };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("contacts public API commands", () => {
  it("returns truthful page metadata and canonicalizes the caller's cursor", async () => {
    const f = fixture(ok([contact], address));
    const result = await runContactRequest(f.client, {
      target: "directory",
      action: "list",
      limit: 3,
      cursor: " Earlier@Example.Test ",
    });
    expect(result).toMatchObject({
      data: [contact],
      meta: { cursor: address },
    });
    expect(f.calls[0]?.url.searchParams.get("cursor")).toBe(
      "earlier@example.test",
    );
    expect(f.calls[0]?.url.searchParams.get("limit")).toBe("3");
  });
  it("gets the canonical address without stripping plus tags", async () => {
    const f = fixture(ok(contact));
    expect(
      await runContactRequest(f.client, {
        target: "directory",
        action: "get",
        address: " Peer+Tag@Example.Test ",
      }),
    ).toEqual(contact);
    expect(decodeURIComponent(f.calls[0]?.url.pathname ?? "")).toBe(
      `/v1/contacts/${address}`,
    );
  });
  it("adds with if_absent and preserves an existing shared label", async () => {
    const f = fixture(ok(contact));
    expect(
      await runContactRequest(f.client, {
        target: "directory",
        action: "add",
        address,
      }),
    ).toEqual(contact);
    expect(f.calls[0]?.body).toEqual({ if_absent: true });
  });
  it("reads a label version once and stops on concurrent update without retrying", async () => {
    const f = fixture(ok(contact), conflict);
    await expect(
      runContactRequest(f.client, {
        target: "directory",
        action: "update",
        address,
        name: "New label",
      }),
    ).rejects.toBeInstanceOf(ContactsApiError);
    expect(f.calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
    expect(f.calls[1]?.body).toEqual({
      if_version: version,
      display_name: "New label",
    });
  });
  it("deletes only the explicit directory version and preserves deleted:false", async () => {
    const f = fixture(ok({ deleted: false }));
    expect(
      await runContactRequest(f.client, {
        target: "directory",
        action: "remove",
        address,
        ifVersion: version,
      }),
    ).toEqual({ deleted: false });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.method).toBe("DELETE");
    expect(f.calls[0]?.url.searchParams.get("if_version")).toBe(version);
  });
  it("ensures an address-only directory entry before adding a membership without changing existing preferences", async () => {
    const f = fixture(ok(contact), ok(member));
    expect(
      await runContactRequest(f.client, {
        target: "agent",
        action: "add",
        address,
        agent,
      }),
    ).toEqual(member);
    expect(f.calls.map((call) => call.body)).toEqual([
      { if_absent: true },
      { if_absent: true },
    ]);
    expect(decodeURIComponent(f.calls[1]?.url.pathname ?? "")).toBe(
      `/v1/agent-contacts/${agent}/${address}`,
    );
  });
  it("does not dispatch a membership write when aborted after directory creation", async () => {
    const controller = new AbortController();
    const f = fixture(ok(contact), ok(member));
    const fetch = f.fetch.getMockImplementation();
    if (!fetch) throw new Error("Missing fixture transport");
    f.fetch.mockImplementation(async (input, init) => {
      const result = await fetch(input, init);
      controller.abort();
      return result;
    });
    await expect(
      runContactRequest(f.client, {
        target: "agent",
        action: "add",
        agent,
        address,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ directoryAvailable: true });
    expect(f.calls.map((call) => call.method)).toEqual(["PUT"]);
  });
  it.each([
    "directory",
    "membership",
  ])("aborts a stalled %s write without retry or subsequent mutation", async (stage) => {
    const controller = new AbortController();
    let resolveStarted!: (signal: AbortSignal) => void;
    const started = new Promise<AbortSignal>((resolve) => {
      resolveStarted = resolve;
    });
    const f = fixture();
    const methods: string[] = [];
    f.fetch.mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      methods.push(request.method);
      if (stage === "membership" && methods.length === 1)
        return Response.json(ok(contact).body);
      resolveStarted(request.signal);
      return new Promise<Response>((_resolve, reject) => {
        if (request.signal.aborted) reject(request.signal.reason);
        else
          request.signal.addEventListener(
            "abort",
            () => reject(request.signal.reason),
            { once: true },
          );
      });
    });
    const result = runContactRequest(f.client, {
      target: "agent",
      action: "add",
      agent,
      address,
      signal: controller.signal,
    });
    const rejected = expect(result).rejects.toThrow();
    const signal = await started;
    expect(signal.aborted).toBe(false);
    controller.abort();
    await rejected;
    expect(signal.aborted).toBe(true);
    expect(methods).toEqual(stage === "directory" ? ["PUT"] : ["PUT", "PUT"]);
  });
  it("never dispatches an already aborted contact request", async () => {
    const f = fixture();
    await expect(
      runContactRequest(f.client, {
        target: "agent",
        action: "add",
        agent,
        address,
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("reports directory success plus membership failure without rollback or fabricated membership", async () => {
    const f = fixture(ok(contact), conflict);
    await expect(
      runContactRequest(f.client, {
        target: "agent",
        action: "add",
        address,
        agent,
        notify: true,
      }),
    ).rejects.toMatchObject({
      directoryAvailable: true,
      payload: conflict.body,
    });
    expect(f.calls.map((call) => call.method)).toEqual(["PUT", "PUT"]);
    expect(f.calls[1]?.body).toEqual({ if_absent: true, notify: true });
  });
  it("finds membership versions across pages and sends only explicitly changed preferences", async () => {
    const earlier = { ...member, contact_address: "earlier@example.test" };
    const f = fixture(
      ok([earlier], earlier.contact_address),
      ok([member], null),
      ok({ ...member, notify: false, version: newer }),
    );
    await runContactRequest(f.client, {
      target: "agent",
      action: "update",
      address,
      agent,
      notify: false,
    });
    expect(f.calls.map((call) => call.method)).toEqual(["GET", "GET", "PUT"]);
    expect(f.calls[1]?.url.searchParams.get("cursor")).toBe(
      earlier.contact_address,
    );
    expect(f.calls[2]?.body).toEqual({ if_version: version, notify: false });
  });
  it("removes only an agent membership using its observed version", async () => {
    const f = fixture(ok([member], null), ok({ deleted: true }));
    await runContactRequest(f.client, {
      target: "agent",
      action: "remove",
      address,
      agent,
    });
    expect(f.calls[1]?.url.searchParams.get("if_version")).toBe(version);
    expect(f.calls[1]?.url.pathname).toContain("/agent-contacts/");
  });
  it.each([
    "missing",
    "cursor",
    "wrong agent",
    "missing version",
  ])("does not mutate after an unsafe membership lookup: %s", async (kind) => {
    const replies =
      kind === "missing"
        ? [ok([], null)]
        : kind === "cursor"
          ? [ok([], "a@example.test"), ok([], "a@example.test")]
          : [
              ok(
                [
                  {
                    ...member,
                    ...(kind === "wrong agent"
                      ? { agent_address: "other@example.test" }
                      : { version: undefined }),
                  },
                ],
                null,
              ),
            ];
    const f = fixture(...replies);
    await expect(
      runContactRequest(f.client, {
        target: "agent",
        action: "update",
        address,
        agent,
        notify: true,
      }),
    ).rejects.toThrow();
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
  });
  it("does not turn incomplete pages into empty successful lists", async () => {
    const f = fixture(ok([]));
    await expect(
      runContactRequest(f.client, { target: "directory", action: "list" }),
    ).rejects.toThrow("pagination");
  });
  it("pins connected profiles to their own address without implicit widening", () => {
    expect(contactAgentAddress(undefined, agent)).toBe(agent);
    expect(contactAgentAddress(agent.toUpperCase(), agent)).toBe(agent);
    expect(() => contactAgentAddress("other@example.test", agent)).toThrow(
      "only its own",
    );
    expect(() => contactAgentAddress()).toThrow("--agent");
  });
});

describe("contact command parsing", () => {
  const root = resolve(import.meta.dirname, "../..");
  function configured(f: ReturnType<typeof fixture>) {
    auth.create.mockResolvedValue({
      apiClient: f.apiClient,
      auth: {
        source: "connected-profile",
        connectedAgent: { agentAddress: agent },
      },
      baseUrlOverridden: false,
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
  }
  it.each([
    {
      command: ContactsList,
      argv: [],
      reply: ok([contact], null),
      method: "GET",
    },
    {
      command: ContactsGet,
      argv: [address],
      reply: ok(contact),
      method: "GET",
    },
    {
      command: ContactsAdd,
      argv: [address, "--name", "Peer"],
      reply: ok(contact),
      method: "PUT",
    },
    {
      command: ContactsRemove,
      argv: [address, "--if-version", version],
      reply: ok({ deleted: true }),
      method: "DELETE",
    },
    {
      command: AgentContactsList,
      argv: [],
      reply: ok([member], null),
      method: "GET",
    },
    {
      command: AgentContactsRemove,
      argv: [address, "--if-version", version],
      reply: ok({ deleted: false }),
      method: "DELETE",
    },
  ])("runs $command.name with its public argument shape", async ({
    command,
    argv,
    reply,
    method,
  }) => {
    const f = fixture(reply);
    configured(f);
    await command.run(argv, { root });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.method).toBe(method);
  });
  it.each(
    [[], ["--notify"], ["--no-notify"]].map((flags) => ({ flags })),
  )("parses agent contacts add %j without defaulting omitted notify", async ({
    flags,
  }) => {
    const f = fixture(ok(contact), ok(member));
    configured(f);
    await AgentContactsAdd.run([address, ...flags], { root });
    expect(f.calls[1]?.body).toEqual({
      if_absent: true,
      ...(flags.length ? { notify: flags[0] === "--notify" } : {}),
    });
  });
  it("parses an explicit membership CAS and clears purpose without changing notify", async () => {
    const f = fixture(ok(member));
    configured(f);
    await AgentContactsUpdate.run(
      [address, "--clear-purpose", "--if-version", version],
      { root },
    );
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.body).toEqual({ if_version: version, purpose: null });
  });
  it("parses a label update and clear-name through organization commands", async () => {
    const f = fixture(ok({ ...contact, display_name: null }));
    configured(f);
    await ContactsUpdate.run(
      [address, "--clear-name", "--if-version", version],
      { root },
    );
    expect(f.calls[0]?.body).toEqual({
      if_version: version,
      display_name: null,
    });
  });
  it("refuses a connected profile's alternate --agent before any request", async () => {
    const f = fixture();
    configured(f);
    await expect(
      AgentContactsAdd.run([address, "--agent", "other@example.test"], {
        root,
      }),
    ).rejects.toThrow("only its own");
    expect(f.calls).toEqual([]);
  });
  it("reports partial directory success on stderr and exits unsuccessfully without printing a membership", async () => {
    const f = fixture(ok(contact), conflict);
    configured(f);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await AgentContactsAdd.run([address, "--notify"], { root });
    expect(process.exitCode).toBe(1);
    expect(console.log).not.toHaveBeenCalled();
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain(
      "membership was not saved",
    );
  });
});
