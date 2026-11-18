import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const home = await mkdtemp(join(tmpdir(), "primitive-member-roles-"));
const id = "11111111-1111-4111-8111-111111111111";
const specs = [
  ["owner", "Owner", null, "builtin"],
  ["admin", "Admin", null, "builtin"],
  ["member", "Member", null, "builtin"],
  ["restricted", "User (template)", id, "template"],
  ["restricted", "Finance reviewer (custom)", id, "custom"],
  ["restricted", "Restricted", null, null],
  ["restricted", "Finance\u001b[2J\nfake line (custom)", id, "custom"],
  ["restricted", "", id, "custom"],
];
const people = specs.map(([role, role_name, role_id, role_kind], index) => ({
  user_id: index === 3 ? id : `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  name: `Reader ${index}`, work_email: null,
  role, role_name, role_id, role_kind, agents: [],
  mail_access: { read: index % 2 === 0, send: index % 3 === 0 },
}));
const grant = { credential_kind: "oauth", grant_type: "computed", template: null,
  permissions: ["mail:read"], mail_scope: "org", catalog_version: "v1", expires_at: null };
const requests = [];
let callerRole = "restricted";
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  requests.push(path);
  const data = path === "/v1/organization/members" ? { items: people, cursor: null, can_invite: false }
    : path === "/v1/cli/orgs" ? { user: { id, email: "reader@example.test" }, user_grant_id: id,
      orgs: [{ id, name: "Example", role: callerRole, available: true, reason: null, message: null }] }
    : path === "/v1/whoami" ? { org_id: id, user_id: id,
      role: callerRole === "restricted" ? "member" : callerRole, auth_method: "oauth", key_id: null, grant }
    : path === "/v1/account" ? { id, email: "reader@example.test", plan: "developer" }
    : path === "/v1/domains" ? [] : undefined;
  response.writeHead(data === undefined ? 404 : 200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data === undefined
    ? { success: false, error: { code: "not_found", message: "Unexpected fixture route" } }
    : { success: true, data }));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert(address && typeof address === "object");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(PRIMITIVE_|CLAUDE|CODEX|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|http_proxy|https_proxy|all_proxy)/.test(key)));
Object.assign(env, { HOME: home, XDG_CONFIG_HOME: home, PRIMITIVE_CONFIG_DIR: home,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" });
const credentialFile = join(home, "credentials.json");
async function saveLogin(role) {
  const expires = new Date(Date.now() + 3600_000).toISOString();
  await writeFile(credentialFile, JSON.stringify({ auth_method: "user_grant",
    access_token: "fixture-org-token", refresh_token: "fixture-refresh-token", token_type: "Bearer",
    expires_at: expires, oauth_grant_id: id, oauth_client_id: "primitive-cli", org_id: id, org_name: "Example",
    api_base_url: `http://127.0.0.1:${address.port}/v1`, created_at: new Date().toISOString(),
    user_grant: { user_grant_id: id, user_id: id, access_token: "fixture-identity-token",
      expires_at: expires, org_role: role, requested_grant: null, org_tokens: {} } }), { mode: 0o600 });
}
function run(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
async function success(args) {
  const result = await run(args);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  if (args.includes("--json")) {
    assert.equal(result.stderr, "");
    return JSON.parse(result.stdout);
  }
  return result.stdout;
}
try {
  await saveLogin(callerRole);
  for (const form of [[], ["--time"]]) {
    requests.length = 0;
    const members = await success(["members", "list", ...form, "--json"]);
    assert.deepEqual(members.data, people.map((person) => ({ ...person,
      role: person.role === "restricted" ? "member" : person.role })));
    assert.deepEqual(requests, ["/v1/organization/members"], "role display must not fetch permissions or roles");
    assert.deepEqual(members.meta, { cursor: null, can_invite: false });
    assert.equal(people[3].role, "restricted", "the source rows must not be mutated");
  }
  {
    requests.length = 0;
    const lines = (await success(["members", "list"])).trim().split("\n");
    assert.equal(lines.length, people.length, "assigned names must not inject rows");
    people.forEach((person, index) => {
      const role = person.role === "restricted" ? "member" : person.role;
      assert(lines[index].includes(`no work email  built-in role ${role}`));
      const assigned = person.role_id && person.role_name;
      assert.equal(lines[index].includes("assigned role:"), Boolean(assigned));
      assert(!/[\u0000-\u001f\u007f]/.test(lines[index]));
      assert(lines[index].includes(`mail: ${person.mail_access.read ? person.mail_access.send ? "read and send" : "read only" : person.mail_access.send ? "send only" : "none"}`));
    });
    assert.deepEqual(requests, ["/v1/organization/members"]);
    assert(lines[3].includes("built-in role member  assigned role: User (template)"));
    assert(lines[6].includes("assigned role: Finance [2J fake line (custom)"));
  }
  for (callerRole of ["owner", "admin", "member", "restricted"]) {
    await saveLogin(callerRole);
    const shown = callerRole === "restricted" ? "member" : callerRole;
    assert.match(await success(["whoami"]), new RegExp(`Built-in role: ${shown}`));
    const identity = await success(["whoami", "--grant", "--json"]);
    assert.equal(identity.role, shown);
    assert.deepEqual(identity.grant, grant);
    assert((await success(["org", "list"])).includes(`built-in role ${shown}`));
    assert.equal((await success(["org", "list", "--json"])).orgs[0].role, shown);
    if (callerRole === "restricted") {
      const own = (await success(["members", "list", "--json"])).data.find((person) => person.user_id === id);
      assert.equal(own.role, identity.role, "the same person's role must agree across views");
      assert.equal(own.role_name, "User (template)");
    }
    assert.equal(JSON.parse(await readFile(credentialFile, "utf8")).user_grant.org_role, callerRole);
  }
  requests.length = 0;
  for (const args of [["members"], ["members", "--help"], ["members", "list", "--help-full"]]) {
    const help = await success(args);
    assert.match(help, /USAGE|COMMANDS/);
    if (args.includes("list")) assert.match(help, /displayed built-in key/);
  }
  assert.deepEqual(requests, []);
  console.log("Member role display: both input forms, assigned metadata, terminal safety, mail access, identity/org parity and help passed.");
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(home, { recursive: true, force: true });
}
