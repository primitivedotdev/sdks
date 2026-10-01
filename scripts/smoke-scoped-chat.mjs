import assert from "node:assert/strict";
import { scopedMailFixture } from "./scoped-mail-smoke-fixture.mjs";

const f = await scopedMailFixture(process.argv[2]);
const flags = ["--json", "--timeout", "3"];
const repliedIds = [];
const chat = (body) => ["chat", f.peer, body, "--from", f.owner, ...flags];
try {
  const bare = await f.run(["chat"]);
  assert.notEqual(bare.code, 0);
  const replyBare = await f.run(["chat", "reply"]);
  assert.notEqual(replyBare.code, 0);
  const help = await f.run(["chat", "--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /share an address event receiver/);
  const replyHelp = await f.run(["chat", "reply", "--help"]);
  assert.equal(replyHelp.code, 0);
  const missing = await f.run(["chat", f.peer, "hello", ...flags]);
  assert.notEqual(missing.code, 0);
  // With --json the refusal is in the one JSON document; stderr stays empty.
  assert.match(missing.stdout, /must pass --from/);
  assert.equal(missing.stderr, "");
  assert.equal(f.requests.length, 0);
  for (const args of [
    chat("hello"),
    ["chat", "reply", "follow up", ...flags],
    ["chat", f.peer, "--reply", "latest parent", "--from", f.owner, ...flags],
  ]) {
    const result = await f.run(args);
    assert.equal(result.code, 0, result.stdout);
    const output = JSON.parse(result.stdout);
    repliedIds.push(output.reply.id);
    assert.equal(output.reply.body_text, "The answer");
    assert.equal(output.match.strategy, "strict");
    assert.ok(
      output.follow_up_commands.some((command) =>
        command.command.includes("emails wait"),
      ),
    );
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /interaction attachment/);
  }
  const uncertainArgs = chat("uncertain send"),
    beforeUnknown = f.posts();
  const uncertain = await f.run(uncertainArgs);
  assert.notEqual(uncertain.code, 0, uncertain.stderr);
  assert.equal(JSON.parse(uncertain.stdout).outcome, "uncertain");
  assert.equal(f.posts(), beforeUnknown + 1);
  f.failLookup(true);
  const unavailable = await f.run(uncertainArgs);
  assert.equal(unavailable.code, 4, unavailable.stderr);
  assert.equal(JSON.parse(unavailable.stdout).outcome, "uncertain");
  assert.equal(f.posts(), beforeUnknown + 1);
  f.failLookup(false);
  const recovered = await f.run(uncertainArgs);
  assert.equal(recovered.code, 0, recovered.stderr);
  assert.equal(JSON.parse(recovered.stdout).reply.body_text, "The answer");
  repliedIds.push(JSON.parse(recovered.stdout).reply.id);
  assert.equal(
    f.posts(),
    beforeUnknown + 1,
    "Unknown send recovery must never POST again",
  );
  assert.ok(
    f.requests.some(
      (request) =>
        request.url.pathname === "/v1/sent-emails" &&
        request.url.searchParams.has("idempotency_key"),
    ),
  );
  const waitingArgs = chat("timeout then resume"),
    waiting = await f.run(waitingArgs);
  assert.equal(waiting.code, 3, waiting.stderr);
  assert.equal(JSON.parse(waiting.stdout).outcome, "sent_awaiting_reply");
  const parent = [...f.sends.values()].at(-1);
  const answer = f.inbound(parent.id);
  f.emails.set(answer.id, answer);
  const beforeResume = f.posts(),
    resumed = await f.run(waitingArgs);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.equal(JSON.parse(resumed.stdout).reply.id, answer.id);
  repliedIds.push(answer.id);
  assert.equal(f.posts(), beforeResume);
  assert.equal(f.maximumStreams(), 1);
  assert.ok(f.completions.length > 0);
  // A satisfied receiver may exit before remote completion. Its returned reply
  // must already remain durable and observed, including across later commands.
  for (const id of repliedIds) {
    const stored = await f.storedEmail(id);
    assert.equal(stored.emailId, id);
    assert.equal(stored.route.kind, "wait");
    assert.equal(stored.route.observed, true);
  }
  assert.ok(
    f.requests.every((request) => request.url.pathname !== "/v1/emails"),
  );
  assert.deepEqual(f.failures, []);
  console.log(
    "Scoped chat packaged smoke passed: authenticated readiness, pushed replies, continuation, unknown-send lookup, timeout/resume, zero inbox scans.",
  );
} finally {
  await f.close();
}
