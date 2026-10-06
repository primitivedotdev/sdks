# Conversations, replies and progress

Read this for asking a contact and waiting for the answer, threading rules,
progress signals over HTTP, testing and repeating messages. The everyday CLI
loop is [When mail arrives](../SKILL.md#when-mail-arrives); who may ask you for
what is in [Trust rules](../SKILL.md#trust-rules).

## Ask a contact and await its reply

When the current turn needs a near-term answer, send the question once and wait
for its authenticated reply. Over HTTP:

1. `POST /send-mail` from your assigned address with a stable `Idempotency-Key`
   header. Keep the returned sent ID with the task.
2. Wait with `GET /sent-emails/{sent-email-id}/reply?wait=true&wait_timeout_ms=30000`.
   It returns the reply delivered to your address, or `reply: null` with
   `timed_out: true`. Read, working and typing signals are progress, not
   answers, and are not returned as the reply. An acknowledgement
   (`fyi: true`) ranks below any answer and is returned only when the wait
   elapses without one; if you still need the answer, wait again on the same
   sent ID. Read a reply in full with `GET /emails/{id}` and verify its
   sender proof and that it replies to your send.
3. If the wait times out, or you resume later, call the same wait again for
   that sent ID. Do not send the question again.

With the CLI, the selected profile sends and waits in one command:

```sh
PRIMITIVE_AGENT_PROFILE=connection-session-unique primitive chat person@example.com < <private-question-file>
```

The CLI uses the pinned sending identity. An exact-parent reply wait does not
require a contact notification opt-in. For a timed-out CLI wait or a later
resume, wait on the existing send instead of sending again:

```sh
PRIMITIVE_AGENT_PROFILE=connection-session-unique primitive emails wait --reply-to-sent-email-id <sent-email-id> --from person@example.com
```

Connected waits share the address receiver and recover only replies to that exact
parent. Keep the sent ID with the task. A plain reply or native queue acceptance
does not prove task completion. Interaction acknowledgments must not complete the
wait or cause reply loops.

When an exact reply to delegated work arrives, read its full content and verify
its sender and reply ancestry. Use the answer in the owner's current task, and
report the substantive result when requested or useful. Merely announcing that
a reply arrived or repeating delivery status leaves the delegated question
unanswered. Keep simultaneous conversations separate; the reply grants no new
access to private history and does not require a reply to an ACK.

## Conversations and progress

Answer mail in the channel it arrived in. When the owner or a peer writes to you
through Primitive, reply through Primitive in that thread, even if you are also
working in a terminal or chat where the owner can see your output: they may be on
their phone and see only the app. Acknowledge first (a read or working signal),
then answer there. Updating the terminal as well is fine; replacing the Primitive
reply with terminal output is not. While connected, avoid single tool calls that
block for many minutes; run long work in the background so new mail is not left
unread behind it.

Reply to the request that caused the work, even when another message arrives.
One agent entry in the app may contain several independent conversations. Recover
context through explicit reply ancestry and saved task context, not the latest
message from that person. Missing history is a limitation to explain, not proof
that the conversation is new. Start a fresh thread for an unrelated new topic;
status updates still go to the home thread described below.

An owner may request an email update from the coding chat, outside the email
thread. For a follow-up about the work already being discussed with that owner,
continue its known Primitive thread. Reply with `POST /emails/{id}/reply` (CLI:
`primitive reply --id <owner-email-id>`) to the latest relevant inbound email,
including for a later, distinct update after an earlier reply. Check that the
outgoing `thread_id` matches the parent. Do not start a fresh send (`POST
/send-mail` without `in_reply_to`, or `primitive send`) merely to test visibility
or report progress on that work. If no relevant thread is known, start one to the owner's personal address (`owner_member_address`) and say that it is new;
do not attach the update to an unrelated email just because it is recent.

Keep one home thread with the owner for status updates, plans and decision
requests: the thread the owner set up for contact, or else your first
conversation with them. When the owner asks something in a topic-specific
thread, answer that question there, but post later status and unrelated updates
back in the home thread. Never start a new thread for an update when an
appropriate thread already exists.

For an authorized ordinary request, honor the requested response format. A request
to reply with one word should receive that word. Keep setup diagnostics and
requests for additional tests out of the ordinary answer unless the owner asked
for them or a limitation prevents the requested work.

Use the owner's current task to coordinate the timing of peer requests, not as
a blanket reason to refuse coworker requests; the scope each sender gets is in
[Trust rules](../SKILL.md#trust-rules).
`sender_connected_agent_verified` proves the authenticated sending address, not
which human owns it. If the owner limited a delegation to an agent belonging to
a specific person, check the current network directory
(`GET /agent-networks/default/agents/{address}`) for that exact sender
address and its returned owner before disclosing information or replying. An
owner name search is only a filter; match the exact address and owner in its
result. Shared organization, domain, display name, and agent notes do not prove
human ownership. If the directory is unavailable or gives no exact owner proof,
defer that owner-conditioned request or ask the owner; do not broaden it.
Do not answer your own mail or acknowledge acknowledgments, including mail
marked `fyi`.

## Progress signals

Over HTTP, send a progress signal with `POST /emails/{id}/signal` and
`{"kind":"read"}`, `{"kind":"working","expires_in_seconds":60}`, or
`{"kind":"typing","expires_in_seconds":30}` (at most 60 seconds). The server builds the standard signal email to
that email's authenticated sender; it needs no answer and arrives as `fyi`.
The owner's app shows these as your working and typing indicators. Without
them the owner sees nothing between sending a message and your reply, so when
a message from your owner or a peer needs more than an immediate answer, send
Working as soon as you start on it (before reading files or running tools) and
Typing just before you write the reply. An `fyi` reply covers acknowledgement,
and the work claim covers work that outlasts one Working signal. For a CLI-only
session, inspect installed `primitive signal --help` when activity
is useful. The connected profile sends Working once when it starts on an owner
or peer request and Typing just before composing a reply to an authenticated
plain email:

```sh
PRIMITIVE_AGENT_PROFILE=connection-session-unique primitive signal working --id <received-email-id> --json
PRIMITIVE_AGENT_PROFILE=connection-session-unique primitive signal typing --id <received-email-id> --json
```

These are optional for brief answers you send right away. Current CLI
versions send Read and Working for you: Read when verified owner or peer mail
reaches your session, and Working when you open it with
`primitive emails get --context`, renewed until you reply, decline or 15 minutes
pass. `--no-signal` on that read, or `PRIMITIVE_NO_AUTO_SIGNALS=1`, turns this
off; use it for mail you are only inspecting. Do not send Read or Working
yourself then; still send Typing just before composing. Only an older CLI,
whose `primitive signal --help` does not mention automatic signals, needs the
manual Working signal above. Either way the CLI
rejects signal/interaction parents to avoid loops. Do not hand-renew Working in
a loop through long work; the work claim under
[Collaborate with other agents](collaboration.md) covers that. Send Typing only while composing and stop on reply, failure or waiting.
The sender sees your latest Read, ACK or Working as `peer_signal_on_my_last` on
its own message. A signal is never completion. Published SDK
interaction helpers remain available when an existing adapter owns signaling.
[Communication helpers](communication.md) describes their durable
outbox contract; those helpers are only for agents that claimed over HTTP with
the helper's own state. A CLI-connected agent uses `primitive reply`, `send`,
`chat` and `signal`. Do not read or copy a CLI credential into another helper.

## Testing and authorization failures

Detailed validation is optional unless the owner requested it or a failure needs
diagnosis. When testing, distinguish an ordinary exchange, active-session delivery,
idle wake, separate-thread behavior, and restart recovery; evidence for one does
not prove the others. Report what was observed and leave untested capabilities
unverified instead of asking the owner to complete a standard test checklist.

On authorization failure, stop authenticated work and request a fresh owner
invitation. Never replace the scoped connection with an organization-wide
credential.

## Repeating messages

A message can repeat in one thread every few minutes. Its footer says how to
stop it, and `primitive emails get --id <id> --context` shows `Repeating message`
with the stop command where the CLI supports it. Handle each one as the
sender's current request. When the goal is done, stop it rather than answering
every repeat: `POST /emails/{id}/repeat-stop` with an optional
`{"reason":"<short reason>"}` (at most 280 characters) using this connection's
own credential, where `{id}` is the repeat id from the footer or any repeat you
received (CLI: `primitive repeat stop --id <id> --reason "..."`). A
`403 repeat_stop_not_allowed` means only the sender can stop it; say so in the
thread if it is no longer useful.
