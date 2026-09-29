import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const configDir = await mkdtemp(join(tmpdir(), "primitive-network-smoke-"));
const agent = "peer+network@example.test";
const otherAgent = "other+network@example.test";
const inboundId = "11111111-1111-4111-8111-111111111111";
const path = `/v1/agent-networks/default/members/${encodeURIComponent(agent)}`;
const peerPath = `/v1/agent-networks/default/agents/${encodeURIComponent(agent)}`;
const calls = [];
const owner = { user_id: "22222222-2222-4222-8222-222222222222", name: "Ben" };
const presence = { last_checked_at: "2026-09-28T12:00:00.000Z", expires_at: "2026-09-28T12:10:00.000Z", valid_for_ms: 12345 };
const peer = { address: agent, name: "Peer", last_seen_at: null, ownership_kind: "personal", owner, presence };
let member = { ...peer, owner: { ...owner, email: "ben@example.test" }, can_view: true, is_listed: true, excluded: false, connected: true, can_manage: true };
const otherMember = { ...member, address: otherAgent, owner: { user_id: "33333333-3333-4333-8333-333333333333", name: "Other", email: "other@example.test" } };

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = raw ? JSON.parse(raw) : undefined;
  calls.push({ method: request.method, path: url.pathname, query: url.searchParams, body });
  response.setHeader("content-type", "application/json");
  const reply = (data, meta) => response.end(JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }));
  const memberLogin = request.headers.authorization === `Bearer ${["local", "network", "member"].join("-")}`;
  const managerLogin = request.headers.authorization === `Bearer ${["local", "network", "fixture"].join("-")}`;
  if (!memberLogin && !managerLogin) {
    response.statusCode = 401;
    return response.end(JSON.stringify({ success: false, error: { code: "unauthorized", message: "Unauthorized" } }));
  }
  if (url.pathname === "/v1/agent-networks" && request.method === "GET")
    return reply([{ id: "default", kind: "organization", is_default: true, name: "Organization", can_manage_all: managerLogin }]);
  if (url.pathname === "/v1/agent-networks/default/members" && request.method === "GET")
    return reply(memberLogin ? [member] : [member, otherMember], { cursor: null });
  if (url.pathname === "/v1/agent-networks/default/agents" && request.method === "GET")
    return reply([peer], { cursor: null });
  if (url.pathname === peerPath && request.method === "GET")
    return reply({ ...peer, last_seen_at: "2026-09-28T12:00:00Z" });
  if (url.pathname === "/v1/agent-networks/default/contact-admission" && request.method === "POST") {
    assert.deepEqual(body, { email_id: inboundId, sender_address: agent });
    return reply({ allowed: false, allowed_since: null, pending: false });
  }
  if (url.pathname === path && request.method === "PATCH") {
    member = { ...member, ...(body.can_view === undefined ? {} : { can_view: body.can_view }), ...(body.is_listed === undefined ? {} : { is_listed: body.is_listed }) };
    return reply(member);
  }
  if (url.pathname === `/v1/agent-networks/default/members/${encodeURIComponent(otherAgent)}` && request.method === "PATCH" && memberLogin) {
    response.statusCode = 404;
    return response.end(JSON.stringify({ success: false, error: { code: "not_found", message: "Not found" } }));
  }
  if (url.pathname === path && request.method === "DELETE") {
    if (memberLogin) {
      response.statusCode = 403;
      return response.end(JSON.stringify({ success: false, error: { code: "forbidden", message: "Forbidden" } }));
    }
    member = { ...member, excluded: true };
    return reply({ excluded: true });
  }
  if (url.pathname === path && request.method === "POST") {
    if (memberLogin) {
      response.statusCode = 403;
      return response.end(JSON.stringify({ success: false, error: { code: "forbidden", message: "Forbidden" } }));
    }
    member = { ...member, excluded: false };
    return reply(member);
  }
  response.statusCode = 404;
  return response.end(JSON.stringify({ success: false, error: { code: "not_found", message: "Unknown fixture route" } }));
});

try {
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const binding = server.address();
  assert.ok(binding && typeof binding !== "string");
  const base = `http://127.0.0.1:${binding.port}/v1`;
  const env = { ...process.env, PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", PRIMITIVE_CONFIG_DIR: configDir };
  delete env.PRIMITIVE_AGENT_PROFILE;
  delete env.PRIMITIVE_API_HEADERS;
  const invoke = async (args) => (await runFile(process.execPath, [binary, ...args], { env, timeout: 15000 })).stdout;
  const api = async (args) => invoke([...args, "--api-key", ["local", "network", "fixture"].join("-"), "--api-base-url", base]);
  const memberApi = async (args) => invoke([...args, "--api-key", ["local", "network", "member"].join("-"), "--api-base-url", base]);

  const overview = await invoke(["network"]);
  for (const action of ["list", "members", "peers", "get", "set", "add", "remove"])
    assert.match(overview, new RegExp(`primitive network ${action}`));
  for (const action of ["list", "members", "peers", "get", "set", "add", "remove"])
    assert.match(await invoke(["network", action, "--help"]), /USAGE|DESCRIPTION/i);
  assert.match((await invoke(["network", "peers", "--help"])).replace(/\s+/g, " "), /recorded API activity/);
  const setHelp = (await invoke(["network", "set", "--help"])).replace(/\s+/g, " ");
  assert.match(setHelp, /initiating network-driven mail wake/);
  assert.match(setHelp, /network-driven wake from viewing senders/);
  assert.match(setHelp, /currently owned personal agents/);
  assert.match((await invoke(["network", "members", "--help"])).replace(/\s+/g, " "), /currently owned personal agents/);
  assert.match(await invoke(["agent-networks"]), /check-default-network-contact-admission/);
  assert.match(await invoke(["agent-networks", "check-default-network-contact-admission", "--help"]), /--email-id/);
  assert.match(await invoke(["network", "--help"]), /agent network/i);
  const operations = JSON.parse(await invoke(["list-operations"]));
  assert.ok(operations.some((operation) => operation.operationId === "listDefaultNetworkAgents"));

  assert.equal(JSON.parse(await api(["network", "list"])).length, 1);
  assert.equal(JSON.parse(await api(["network", "members", "--limit", "10"])).data[0].address, agent);
  const peerPage = JSON.parse(await api(["network", "peers", "--limit", "10"]));
  assert.equal(peerPage.data[0].address, agent);
  assert.equal(peerPage.data[0].last_seen_at, null);
  assert.deepEqual(peerPage.data[0].presence, presence, "Default JSON must preserve the server presence timestamps and TTL unchanged");
  const ownedPeers = JSON.parse(await api(["network", "peers", "--owner", "Ben", "--json"]));
  assert.deepEqual(ownedPeers.data, [peer]);
  const selectedPeer = JSON.parse(await api(["network", "get", agent]));
  assert.equal(selectedPeer.address, agent);
  assert.deepEqual(selectedPeer.presence, presence, "Single-peer discovery must preserve all three server presence fields");
  assert.equal(selectedPeer.last_seen_at, "2026-09-28T12:00:00Z");
  assert.equal(JSON.parse(await api(["network", "set", agent, "--see", "off", "--be-seen", "off"])).can_view, false);
  assert.equal(member.is_listed, false);
  assert.deepEqual(JSON.parse(await api(["network", "remove", agent])), { excluded: true });
  assert.equal(JSON.parse(await api(["network", "add", agent])).excluded, false);
  assert.deepEqual(
    JSON.parse(await api(["agent-networks", "check-default-network-contact-admission", "--email-id", inboundId, "--sender-address", agent])),
    { allowed: false, allowed_since: null, pending: false },
  );
  assert.deepEqual(calls.map(({ method }) => method), ["GET", "GET", "GET", "GET", "GET", "PATCH", "DELETE", "POST", "POST"]);
  assert.deepEqual(calls[5].body, { can_view: false, is_listed: false });
  assert.equal(calls[1].query.get("limit"), "10");
  assert.equal(calls[2].query.get("limit"), "10");
  assert.equal(calls[3].path, "/v1/agent-networks/default/agents");
  assert.deepEqual(Object.fromEntries(calls[3].query), { limit: "50", owner: "Ben" });
  assert.equal(JSON.parse(await memberApi(["network", "list"]))[0].can_manage_all, false);
  const ownRows = JSON.parse(await memberApi(["network", "members", "--limit", "10"]));
  assert.deepEqual(ownRows.data.map(({ address }) => address), [agent]);
  assert.equal(ownRows.data[0].can_manage, true);
  const updatedOwn = JSON.parse(await memberApi(["network", "set", agent, "--see", "on", "--be-seen", "on"]));
  assert.equal(updatedOwn.can_view, true);
  assert.equal(updatedOwn.is_listed, true);
  await assert.rejects(memberApi(["network", "set", otherAgent, "--see", "off"]));
  await assert.rejects(memberApi(["network", "remove", agent]));
  await assert.rejects(memberApi(["network", "add", agent]));
  process.stdout.write("Built network parent, help, manifest, manager roster, member-own roster/set, and manager-only removal/restoration passed.\n");
} finally {
  server.close();
  await rm(configDir, { recursive: true, force: true });
}
