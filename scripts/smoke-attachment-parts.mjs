import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const directory = await mkdtemp(join(tmpdir(), "primitive-attachment-parts-"));
const fixture = JSON.parse(await readFile(new URL("../test-fixtures/attachment-part.json", import.meta.url), "utf8"));
const expected = Buffer.from(fixture.bytes);
const requests = [];
const key = ["fixture", "credential"].join("-");
const server = createServer((request, response) => {
  requests.push({ method: request.method, path: request.url });
  assert.equal(request.headers.authorization, `Bearer ${key}`);
  if (request.url.endsWith("/attachments/8")) {
    response.writeHead(409, { "content-type": "application/json" });
    response.end(JSON.stringify({ success: false, error: { code: "attachment_changed", message: "Refresh email detail before selecting a part again." } }));
    return;
  }
  response.writeHead(200, { "content-type": "application/octet-stream", "x-content-sha256": fixture.sha256, "content-disposition": fixture.content_disposition, "cache-control": "private, no-store" });
  response.end(expected);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/v1`;
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], {
      env: { ...process.env, PRIMITIVE_CONFIG_DIR: directory, XDG_CONFIG_HOME: directory, PRIMITIVE_API_KEY: key,
        PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [], stderr = [];
    child.stdout.on("data", chunk => stdout.push(chunk));
    child.stderr.on("data", chunk => stderr.push(chunk));
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); resolve({ code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString() }); });
  });
}
try {
  for (const [parent, command, resource] of [["emails", "download-email-attachment-part", "emails"], ["sending", "download-sent-attachment-part", "sent-emails"]]) {
    const bare = await run([parent]);
    assert.equal(bare.code, 0, bare.stderr);
    assert.match(bare.stdout.toString() + bare.stderr, new RegExp(command));
    const help = await run([parent, command, "--help"]);
    assert.equal(help.code, 0, help.stderr);
    assert.match(help.stdout.toString(), /--part-index/);
    assert.match(help.stdout.toString(), /--output/);
    assert.doesNotMatch(help.stdout.toString(), /--json/);
    const args = [parent, command, "--id", fixture.id, "--part-index", "7", "--api-base-url", base];
    const stdout = await run(args);
    assert.equal(stdout.code, 0, stdout.stderr);
    assert.deepEqual(stdout.stdout, expected, "stdout must contain only the original bytes");
    const output = join(directory, `${resource}.bin`);
    const file = await run([...args, "--output", output]);
    assert.equal(file.code, 0, file.stderr);
    assert.equal(file.stdout.length, 0);
    assert.deepEqual(await readFile(output), expected);
    const failure = await run([parent, command, "--id", fixture.id, "--part-index", "8", "--api-base-url", base]);
    assert.notEqual(failure.code, 0);
    assert.equal(failure.stdout.length, 0);
    assert.match(failure.stderr, /attachment_changed/);
  }
  assert.deepEqual(requests, ["emails", "sent-emails"].flatMap(resource => [7, 7, 8].map(index => ({ method: "GET", path: `/v1/${resource}/${fixture.id}/attachments/${index}` }))));
  console.log("Attachment part commands: bare parents, help, exact binary stdout/files, and errors passed.");
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
