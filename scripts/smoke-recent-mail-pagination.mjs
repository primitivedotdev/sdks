import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const home = await mkdtemp(join(tmpdir(), "primitive-recent-mail-"));
const requests = [];
let page;
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  response.setHeader("content-type", "application/json");
  if (url.pathname === "/v1/domains") {
    response.end(JSON.stringify({ success: true, data: [{ id: "domain-one", domain: "example.com", verified: true }] }));
    return;
  }
  assert.equal(url.pathname, "/v1/emails");
  const query = Object.fromEntries(url.searchParams);
  requests.push(query);
  const reply = page(query, requests.length);
  response.statusCode = reply.status ?? 200;
  response.end(JSON.stringify(reply.body ?? { success: true, data: reply.data ?? [], meta: reply.meta ?? { cursor: null } }));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const listening = server.address();
assert(listening && typeof listening === "object");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/^(PRIMITIVE_|CODEX_|CLAUDE_|XDG_)/.test(name) && !/proxy/i.test(name)));
Object.assign(env, {
  HOME: home, XDG_CONFIG_HOME: home, PRIMITIVE_CONFIG_DIR: home,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", PRIMITIVE_API_KEY: "prim_test_only",
  PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${listening.port}/v1`,
  NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost",
});
function run(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.on("error", reject);
    child.on("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
const row = (n) => ({ id: `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`, sender: "peer@example.com", recipient: "inbox@example.com", subject: `mail ${n}`, awaiting: "you", reply_count: 0, last_replied_at: null });
async function latest(args = [], json = true) {
  const result = await run(["emails", "latest", "--all-domains", ...args, ...(json ? ["--json"] : [])]);
  if (json) assert.equal(result.stderr, "", result.stderr);
  return { ...result, document: json ? JSON.parse(result.stdout) : undefined };
}
try {
  for (const args of [["emails"], ["emails", "latest", "--help"]]) {
    const result = await run(args);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout + result.stderr, /latest|cursor/);
  }
  assert.equal(requests.length, 0);
  for (const command of ["latest", "list"]) {
    requests.length = 0;
    page = (_query, n) => ({ data: Array.from({ length: 100 }, (_, i) => row((n - 1) * 100 + i)), meta: { cursor: n === 1 ? "next/+==" : "continue/+==", has_more: true, count: 999 } });
    const result = await run(["emails", command, "--limit", "200", "--cursor", "opaque/+==", "--awaiting", "you", "--domain", "example.com", "--json"]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.data.length, 200);
    assert.equal(document.data[199].id, row(199).id);
    assert.equal(document.meta.cursor, "continue/+==");
    assert.equal(document.meta.has_more, true);
    assert.equal(document.meta.count, 999);
    assert.deepEqual(document.meta.focus.domains, ["example.com"]);
    assert.deepEqual(requests.map(({ limit, cursor, awaiting, domain_ids }) => ({ limit, cursor, awaiting, domain_ids })), [
      { limit: "100", cursor: "opaque/+==", awaiting: "you", domain_ids: "domain-one" },
      { limit: "100", cursor: "next/+==", awaiting: "you", domain_ids: "domain-one" },
    ]);
  }
  requests.length = 0;
  const human = await latest(["--limit", "200"], false);
  assert.equal(human.code, 0, human.stderr);
  assert.equal(human.stdout.trim().split("\n").length, 200);
  assert.equal((human.stderr.match(/RECEIVED \(UTC\)/g) ?? []).length, 1);
  assert.match(human.stderr, /next cursor: continue\/\+==/);
  requests.length = 0;
  page = (_query, n) => ({ data: n === 2 ? [row(1)] : [], meta: { cursor: n < 3 ? `page-${n}` : null } });
  const short = await latest(["--limit", "3"]);
  assert.equal(short.document.data.length, 1);
  assert.equal(short.document.meta.cursor, null);
  assert.equal(requests.length, 3);
  for (const command of ["latest", "list"]) {
    for (const cursors of [["repeat", "repeat"], ["one", "two", "one"]]) {
      requests.length = 0;
      page = (_query, n) => ({ meta: { cursor: cursors[n - 1] } });
      const result = await run(["emails", command, "--all-domains", "--limit", "200", "--json"]);
      assert.equal(result.code, 0, result.stdout);
      assert.equal(result.stderr, "");
      assert.equal(requests.length, cursors.length);
      assert.match(JSON.stringify(JSON.parse(result.stdout).warnings), /repeated a cursor/);
    }
    requests.length = 0;
    page = (_query, n) => ({ meta: { cursor: `page-${n}` } });
    const result = await run(["emails", command, "--domain", "example.com", "--limit", "200", "--json"]);
    assert.equal(result.code, 0, result.stdout);
    assert.equal(result.stderr, "");
    assert.equal(requests.length, 22);
    const bounded = JSON.parse(result.stdout);
    assert.equal(bounded.meta.cursor, "page-22");
    assert.match(JSON.stringify(bounded.warnings), /Stopped after 22 requests/);
    assert.match(bounded.summary, /list goes on/);
    assert.doesNotMatch(bounded.summary, /Nothing matched|No inbound emails yet/);
  }
  for (const json of [false, true]) {
    requests.length = 0;
    page = () => ({ meta: { cursor: null } });
    const result = await run(["emails", "latest", "--domain", "example.com", "--cursor", "history/+==", ...(json ? ["--json"] : [])]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    if (json) assert.equal(result.stderr, "");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].cursor, "history/+==");
    assert.equal(requests[0].count, undefined);
    const output = json ? JSON.stringify(JSON.parse(result.stdout).summary) : result.stderr;
    assert.match(output, /past the given --cursor/);
    assert.doesNotMatch(output, /Nothing matched|No inbound emails yet|other domains/);
  }
  for (const failure of ["http", "filter"]) {
    requests.length = 0;
    page = (_query, n) => n === 1 ? { data: [row(1)], meta: { cursor: "next" } } : failure === "http"
      ? { status: 403, body: { success: false, error: { code: "forbidden", message: "Access denied" } } }
      : { data: [{ id: "unsupported" }], meta: { cursor: null } };
    const failed = await latest(["--limit", "200", "--awaiting", "you"]);
    assert.notEqual(failed.code, 0);
    assert.notEqual(failed.document.success, true);
    assert.ok(failed.document.error);
    assert.equal(failed.document.data, undefined);
    assert.equal(requests.length, 2);
  }
  for (const command of ["latest", "list"]) {
    requests.length = 0;
    page = (_query, n) => ({ body: { success: true, data: [row(n)],
      warnings: [n === 1 ? "first page warning" : "last page warning"],
      ...(n === 1 ? { marker: "preserved" } : {}),
      meta: { cursor: n === 1 ? "next" : null, ...(n === 1 ? { recipient_rules_only: true } : { count: 2 }) } } });
    const result = await run(["emails", command, "--all-domains", "--limit", "200", "--json"]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    const metadata = JSON.parse(result.stdout);
    assert.equal(metadata.marker, "preserved");
    assert.equal(metadata.meta.recipient_rules_only, true);
    assert.equal(metadata.meta.count, 2);
    assert.deepEqual(metadata.warnings, ["first page warning", "last page warning"]);
  }
  requests.length = 0;
  page = () => ({ data: [row(0)], meta: { cursor: "next" } });
  const single = await run(["emails", "list", "--all-domains", "--limit", "10", "--json"]);
  assert.equal(single.code, 0, single.stdout);
  assert.equal(requests.length, 1);
  for (const args of [["--wait", "1"], ["--since", "opaque"]]) {
    requests.length = 0;
    const refused = await run(["emails", "list", "--all-domains", "--limit", "200", ...args, "--json"]);
    assert.notEqual(refused.code, 0);
    assert.equal(requests.length, 0);
  }
  requests.length = 0;
  page = () => ({ meta: { cursor: null } });
  const maximum = await latest(["--limit", "1000"]);
  assert.equal(maximum.code, 0);
  assert.equal(requests[0].limit, "100");
  requests.length = 0;
  page = () => ({ data: [row(0)], meta: { cursor: null } });
  const defaultLimit = await latest();
  assert.equal(defaultLimit.code, 0);
  assert.equal(requests[0].limit, "10");
  requests.length = 0;
  const invalid = await latest(["--limit", "1001"]);
  assert.notEqual(invalid.code, 0);
  assert.equal(requests.length, 0);
  console.log("Recent-mail paging: bounded requests, filters, cursors, errors, help and output streams passed.");
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(home, { recursive: true, force: true });
}
