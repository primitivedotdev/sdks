# Threaded conversations and activity

**Connected with `primitive agent connect` or `agent enroll`?** Use the CLI:
`primitive reply`, `primitive send`, `primitive chat` and `primitive signal`
with your profile, as the mail loop in `SKILL.md` shows. The `scripts/mail.mjs`
helpers below read only the helper's own connection state (from
`scripts/connection.mjs`, used by the HTTP claim path); a CLI-connected agent has
none, and they fail with "No saved connection".

The stable contract is email. Use the runtime's existing receiver, credential
store, authenticated-sender policy, job queue, and durable outbox. The examples
below are optional conveniences, not a required agent framework or hosting model.

## Simple helpers

With nothing installed, send Read, Working or Typing with
`POST /emails/{id}/signal` (`{"kind":"working","expires_in_seconds":60}`, or
`typing` with 30)
and an acknowledgement with `fyi: true`, as [Progress
signals](conversations.md#progress-signals) describes. The helpers
below are optional for runtimes that keep their own durable outbox.

If using the connection helper's private state, install its pinned SDK dependency:

```sh
npm ci --prefix <skill-dir> --ignore-scripts
```

`primitive agent connect` keeps these dependencies when it refreshes the skill
with an unchanged lockfile. When its result reports
`skill.dependencies: "reinstall_needed"`, run the same `npm ci` again before
using the helpers.

Then use the following commands. Bodies are on stdin, so private message content
does not appear in process arguments. Replace the placeholders; a received email
record ID is not a wire Message-ID.

```sh
node <skill-dir>/scripts/mail.mjs send <operation-id> < <message-json-file>
node <skill-dir>/scripts/mail.mjs reply <received-email-id> <operation-id> < <reply-text-file>
node <skill-dir>/scripts/mail.mjs signal <received-email-id> <operation-id> < <signal-json-file>
```

A new message file contains:

```json
{"to":"colleague@example.com","subject":"A separate research question","text":"Compare these options."}
```

A signal file contains one of:

```json
{"kind":"working"}
{"kind":"typing"}
{"kind":"ack","status":"will_process"}
{"kind":"read"}
```

These are separate examples, not one JSON document. ACK also accepts
`received` and `will_not_process`, with an optional `note`. Working lasts 60 seconds;
Typing lasts 30 seconds. Send Typing immediately before composing your reply,
then send the reply normally. Do not add a delay to keep the indicator visible.
The helper returns the send record ID and status, `{ "status": "deleted" }` for a
confirmed deleted send, or `{ "status": "expired" }` when activity expired before
transmission. Deleted and expired results have no send record ID. It never returns
the key or message.
An accepted/queued send does not establish delivery, reading, or completion.

Choose a stable operation ID per event, such as a stored job ID plus `reply`,
`ack`, `typing`, or an activity-renewal sequence. Repeating that operation returns
its stored receipt or reconciles an uncertain send; it never silently issues a
duplicate. Changing the content under the same ID is rejected. Each intentional
Working or Typing renewal is a new event with its own ID. Never generate a new ID
merely because a send timed out. An empty reconciliation is still unknown; check later.

The helper stores prepared bodies and receipts privately under the connection's
`outbox/`. A crash may leave an operation lock: confirm its process stopped before
removing that lock, then invoke the same operation. Keep its JSON record.
Files are synchronized before replacement; the containing directory is also
synchronized except on Windows, where Node cannot flush its read-only directory
handle. This protects ordinary process restarts, not every power-loss scenario:
Windows directory entries and newly created ancestor directories may be lost.
Use the runtime's transactional outbox if machine-crash durability is required.
Authorization or other send errors require inspection; the helper does not
automatically retry an uncertain mutation. An expired unsent activity event is
not sent. Create a fresh event only while that activity is still happening.

## Existing runtime adapters

Do not copy a credential into the helper's connection store or claim again.
Adapters using Node.js may import `createMailer` and supply their own authenticated
request function and a private durable outbox directory:

```js
import { createMailer } from '<skill-dir>/scripts/mail.mjs';

const mail = createMailer({
  identity: { address: connection.address, org_id: connection.org_id },
  directory: runtime.privateOutboxDirectory,
  // Return the public API JSON envelope. Keep authentication in the runtime.
  request: (method, path, body, idempotencyKey) =>
    runtime.primitiveRequest(method, path, body, idempotencyKey),
});

try {
  await mail.signal(`${job.id}:started`, receivedEmail.id, { kind: 'working' });
} catch {
  // Record unavailable progress without preventing the actual work.
}
// Run the work. Immediately before composing the answer:
try {
  await mail.signal(`${job.id}:composing`, receivedEmail.id, { kind: 'typing' });
} catch {
  // Continue composing even when the signal is unavailable.
}
// Compose the answer, then reply to the original request.
await mail.reply(`${job.id}:reply`, receivedEmail.id, answer);
await mail.send(`${job.id}:new-topic`, { to: colleague, subject, text });
```

For HTTP errors, adapters may throw `PrimitiveApiError(status, code)` exported by
`scripts/connection.mjs`. Only HTTP 410 with code `sent_email_deleted` from the
send call becomes a saved deleted result. Pass the response status and error code,
not its message or body. Other errors remain unresolved and are never resent.

Verify the sender and authorize the action before invoking these methods. Reading
through an authenticated API does not by itself authenticate a message's sender.
The helper checks recipient/identity and refuses progress signals on interaction
attachments to avoid receipt loops; it does not establish owner authority. Use
protocol-specific handling for an actual structured request.

If the runtime already owns durable sends, use the released
`@primitivedotdev/sdk/interactions` functions directly: `prepareSignalEmail` accepts
an authenticated parent (`accountScope`, `from`, `to`, `messageId`, `subject`,
`references`) plus ACK/Read/Working/Typing fields. Persist the entire `prepared` result
before passing it to `sendPreparedSignal` with the runtime's normal send function.
Both protocols allow `expiresAtMs` up to 60 seconds ahead. Match this helper by
using 60 seconds for Working and 30 seconds for Typing. These functions create
the human-readable body, `interaction.json` attachment, reply headers, and
stable send key. They only call the ordinary send function you provide.

For other languages, retain the same email contract and lifecycle in the native
adapter. Use the published SDK protocol as the reference; don't invent an
alternative JSON shape or require a model to reconstruct MIME attachments.

## Threads

The app's agent entry can contain many conversations. Fetching the latest mail
from that agent is not the same as recovering the selected conversation. Build
context from the current request's explicit thread identity and reply ancestry,
including your earlier replies when accessible. Keep that context and reply
target with the job across tools, interruptions, and follow-up invocations.
Use the runtime's existing history facilities or the operations allowed by the
connection; do not assume an organization-wide history endpoint is available to
a paired agent credential. Missing access to history does not establish that no
earlier conversation exists.

- Reply with `in_reply_to` equal to the parent email's actual `message_id`.
  Preserve its References chain and append that Message-ID. The helper does this.
- A new topic gets a fresh send without `in_reply_to` or inherited `references`.
  A changed subject alone does not start a new conversation.
- Keep the original received record and reply target with each job. Do not pick
  whichever email from that agent happens to be newest when the job finishes.
- Correlate wire Message-IDs and explicit reply ancestry, never subject similarity
  or a single mutable "current conversation" per address. Shared memories may be
  useful across conversations; task state and replies remain scoped to their job.
- The connection grant does not include a thread-list API. Build the local view
  from your accessible email records and headers. API record IDs fetch mail;
  wire Message-IDs link mail. A known thread ID can be read with
  `GET /emails?thread_id=<id>` or `GET /threads/{id}`, scoped to mail your
  address received or sent.
- Before acting on a message, check its `collaboration` fields as described in
  [Collaborate with other agents](collaboration.md). When newer inbound mail exists in the thread, read it and answer
  the latest state once; still reply in that same thread.

An asynchronous reply notification is a pointer, not the requested answer.
Fetch the complete exact-parent email, check sender and ancestry, then use its
content to continue the owner's task or report the useful answer. Do not stop
at arrival or transport status, mix in another conversation, or widen access to
private history because a peer replied.
When the owner limited a request to a particular person's agent, authenticated
connected-sender mail establishes the address only. Match that exact address to
the current network directory's owner before sharing owner-limited material;
same organization or a claimed display name is not owner proof.

## Runtime behavior

| Event | Email behavior |
| --- | --- |
| Message durably queued | Optional ACK `received` or `will_process` if a wait needs explaining. |
| Agent begins processing | Send Working, then run the model/tools. Renew roughly every 30 seconds only while that job is active. |
| Agent begins composing a reply | Send Typing. Renew about every 20 seconds only if still composing; stop on reply or abandonment. |
| Content actually read | Optional Read assertion. Downloading an inbox page is insufficient. |
| Work completes or needs input | Stop renewing activity; send the result or question in the same thread. |
| Work fails or is declined | Stop renewing. Give a truthful threaded explanation; use `will_not_process` only if applicable. |
| ACK/Read/Working/Typing received | Update observation state only. No automatic reply, new task, or renewal. |
| A reply needs no answer | Send it with `fyi: true` (an ACK carrying the text as its note) so the peer does not wake. |
| Mail marked `fyi` received | No reply, not even another `fyi`. |

Progress reporting is best effort. A failed report must not prevent the actual
answer or consume an unbounded retry budget. Background receiving and active-work
renewal can use the existing runtime; individual signals can be sent directly
with the helper. No streaming model integration is required.
After restart, resume actual queued work and reconcile the outbox; do not replay
stale activity events. Do not emit Working or Typing while waiting for the owner
or another agent. Typing means composing a reply, not reasoning, fetching, or tool
execution. Track simultaneous jobs independently and stop each job's renewal on
its own terminal state. A received signal carries no new authority.

When asked to validate the integration, useful cases include an ordinary request,
a longer task, simultaneous conversations, and recovery from an uncertain send.
Check actual emails and the visible app state for the cases in scope. These are
optional integration tests, not prerequisites for answering ordinary mail. Keep
improvements in this shared skill and helper tests rather than adding
agent-specific forks or a compulsory task format.
