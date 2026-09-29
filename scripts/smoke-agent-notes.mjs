import { execFile } from "node:child_process";
import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const address = "note-test@example.test";
const name = "AGENT_INFO";
let saved = null;
let version = 0;
const calls = [];

function reply(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
  calls.push({ method: request.method, path: url.pathname, query: url.searchParams, body });
  if (request.headers.authorization !== `Bearer ${["local", "note", "test"].join("-")}`) {
    reply(response, 401, { success: false, error: { code: "unauthorized", message: "Unauthorized" } });
    return;
  }
  if (url.pathname === "/v1/address-notes" && request.method === "GET") {
    reply(response, 200, { success: true, data: saved ? [saved] : [], meta: { limit: 50, cursor: null } });
    return;
  }
  if (decodeURIComponent(url.pathname) !== `/v1/address-notes/${address}/${name}`) {
    reply(response, 404, { success: false, error: { code: "not_found", message: "Not found" } });
    return;
  }
  if (request.method === "GET") {
    reply(response, saved ? 200 : 404, saved
      ? { success: true, data: saved }
      : { success: false, error: { code: "not_found", message: "Not found" } });
    return;
  }
  if (request.method === "PUT") {
    assert.equal(body.if_absent === true || body.if_version === saved?.version, true);
    assert.equal(body.visibility, undefined);
    version += 1;
    saved = {
      address,
      name,
      value: body.value,
      visibility: "private",
      version: String(version),
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    reply(response, 200, { success: true, data: saved });
    return;
  }
  if (request.method === "DELETE") {
    assert.equal(url.searchParams.get("if_version"), saved?.version);
    saved = null;
    reply(response, 200, { success: true, data: { deleted: true } });
    return;
  }
  reply(response, 405, { success: false, error: { code: "validation_error", message: "Bad method" } });
});

const temp = mkdtempSync(join(tmpdir(), "primitive-note-smoke-"));
try {
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const binding = server.address();
  if (!binding || typeof binding === "string") throw new Error("Missing local port");
  const common = ["--address", address, "--api-key", ["local", "note", "test"].join("-"), "--api-base-url", `http://127.0.0.1:${binding.port}/v1`];
  const env = { ...process.env };
  delete env.PRIMITIVE_AGENT_PROFILE;
  delete env.PRIMITIVE_API_HEADERS;
  const invoke = async (args) => {
    const result = await runFile(process.execPath, [binary, ...args], { env, timeout: 10000 });
    return result.stdout;
  };

  const topic = await invoke(["agent", "notes"]);
  for (const command of ["list", "get", "set", "delete"])
    assert.match(topic, new RegExp(`agent notes ${command}`));
  const file = join(temp, "info.json");
  writeFileSync(file, JSON.stringify({ name: "Agent", description: "Research" }));
  const created = JSON.parse(await invoke(["agent", "notes", "set", name, "--value-file", file, "--json-value", "--if-absent", ...common]));
  assert.deepEqual(created.value, { name: "Agent", description: "Research" });
  assert.equal(created.visibility, "private");
  assert.equal(JSON.parse(await invoke(["agent", "notes", "get", name, ...common])).version, "1");
  assert.equal(JSON.parse(await invoke(["agent", "notes", "list", ...common])).data.length, 1);
  assert.deepEqual(JSON.parse(await invoke(["agent", "notes", "delete", name, ...common])), { deleted: true });
  assert.deepEqual(calls.map((call) => call.method), ["PUT", "GET", "GET", "GET", "DELETE"]);
  process.stdout.write("Built agent notes list/get/set/delete and bare parent passed.\n");
} finally {
  server.close();
  rmSync(temp, { recursive: true, force: true });
}
