import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const agent = "peer+network@example.test";
const path = `/v1/agent-networks/default/members/${encodeURIComponent(agent)}`;
const peerPath = `/v1/agent-networks/default/agents/${encodeURIComponent(agent)}`;
const calls = [];
let member = { address: agent, name: "Peer", can_view: true, is_listed: true, excluded: false, connected: true, last_seen_at: null };

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = raw ? JSON.parse(raw) : undefined;
  calls.push({ method: request.method, path: url.pathname, query: url.searchParams, body });
  response.setHeader("content-type", "application/json");
  const reply = (data, meta) => response.end(JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }));
  if (request.headers.authorization !== `Bearer ${["local", "network", "fixture"].join("-")}`) {
    response.statusCode = 401;
    return response.end(JSON.stringify({ success: false, error: { code: "unauthorized", message: "Unauthorized" } }));
  }
  if (url.pathname === "/v1/agent-networks" && request.method === "GET")
    return reply([{ id: "default", kind: "organization", is_default: true, name: "Organization" }]);
  if (url.pathname === "/v1/agent-networks/default/members" && request.method === "GET")
    return reply([member], { cursor: null });
  if (url.pathname === "/v1/agent-networks/default/agents" && request.method === "GET")
    return reply([{ address: agent, name: "Peer", last_seen_at: null }], { cursor: null });
  if (url.pathname === peerPath && request.method === "GET")
    return reply({ address: agent, name: "Peer", last_seen_at: "2026-09-28T12:00:00Z" });
  if (url.pathname === path && request.method === "PATCH") {
    member = { ...member, ...(body.can_view === undefined ? {} : { can_view: body.can_view }), ...(body.is_listed === undefined ? {} : { is_listed: body.is_listed }) };
    return reply(member);
  }
  if (url.pathname === path && request.method === "DELETE") {
    member = { ...member, excluded: true };
    return reply({ excluded: true });
  }
  if (url.pathname === path && request.method === "POST") {
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
  const env = { ...process.env, PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1" };
  delete env.PRIMITIVE_AGENT_PROFILE;
  delete env.PRIMITIVE_API_HEADERS;
  const invoke = async (args) => (await runFile(process.execPath, [binary, ...args], { env, timeout: 15000 })).stdout;
  const api = async (args) => invoke([...args, "--api-key", ["local", "network", "fixture"].join("-"), "--api-base-url", base]);

  const overview = await invoke(["network"]);
  for (const action of ["list", "members", "peers", "get", "set", "add", "remove"])
    assert.match(overview, new RegExp(`primitive network ${action}`));
  for (const action of ["list", "members", "peers", "get", "set", "add", "remove"])
    assert.match(await invoke(["network", action, "--help"]), /USAGE|DESCRIPTION/i);
  assert.match((await invoke(["network", "peers", "--help"])).replace(/\s+/g, " "), /recorded API activity/);
  assert.match(await invoke(["network", "--help"]), /agent network/i);
  const operations = JSON.parse(await invoke(["list-operations"]));
  assert.ok(operations.some((operation) => operation.operationId === "listDefaultNetworkAgents"));

  assert.equal(JSON.parse(await api(["network", "list"])).length, 1);
  assert.equal(JSON.parse(await api(["network", "members", "--limit", "10"])).data[0].address, agent);
  const peerPage = JSON.parse(await api(["network", "peers", "--limit", "10"]));
  assert.equal(peerPage.data[0].address, agent);
  assert.equal(peerPage.data[0].last_seen_at, null);
  const peer = JSON.parse(await api(["network", "get", agent]));
  assert.equal(peer.address, agent);
  assert.equal(peer.last_seen_at, "2026-09-28T12:00:00Z");
  assert.equal(JSON.parse(await api(["network", "set", agent, "--see", "off", "--be-seen", "off"])).can_view, false);
  assert.equal(member.is_listed, false);
  assert.deepEqual(JSON.parse(await api(["network", "remove", agent])), { excluded: true });
  assert.equal(JSON.parse(await api(["network", "add", agent])).excluded, false);
  assert.deepEqual(calls.map(({ method }) => method), ["GET", "GET", "GET", "GET", "PATCH", "DELETE", "POST"]);
  assert.deepEqual(calls[4].body, { can_view: false, is_listed: false });
  assert.equal(calls[1].query.get("limit"), "10");
  assert.equal(calls[2].query.get("limit"), "10");
  process.stdout.write("Built network parent, help, manifest, and list/members/peers/get/set/remove/add passed.\n");
} finally {
  server.close();
}
