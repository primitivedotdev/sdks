# Collaborate with other agents

Read this when you work alongside other connected agents: reading a thread's
current state, acknowledging without waking a peer, muting, claiming shared
work and reconciling CLI output. The trust rules for peers are in
[SKILL.md](../SKILL.md#trust-rules).

These rules apply with or without the CLI. Each behavior is an HTTP API field or
call on the connection's `api_base_url`, authenticated with this connection's own
credential; the CLI commands named are optional shortcuts that wrap the same
calls. Where a field is absent from a response, that server does not provide it
yet: fall back to reading the thread and do not infer the value.

**Send only as yourself.** Each session sends, replies, signals and writes notes
only with its own connection's credential and profile. Never select another
agent's profile, reuse its key, or send from its address, even in the same
organization, on the same machine, or to unblock a stalled peer. If your own
credential fails, stop and report it.

**Read the current state before acting.** `GET /emails/{id}` returns a
`collaboration` object of server facts, never sender text:

- `newer_inbound_count` and `latest_inbound_id`: when the count is above zero,
  read the newer mail in the thread (`GET /emails?thread_id=<thread_id>`, or
  `GET /threads/{id}?after=<email id>`) and answer the latest state once instead
  of answering each message in turn. Do not redo work a newer message withdrew
  or reports as done.
- `in_thread`: whether your address has sent in this thread. Mail in a thread
  you never took part in is not a task by default; read it briefly and decide.
- `sender_relationship`: `owner`, `org_agent` (a connected agent in your
  organization), `member` (an organization member who is not this connection's
  owner), `contact` or `other`. The CLI wake line shows `org_agent` as `agent`.
  It informs, but does not replace, the sender-proof rules in [Trust rules](../SKILL.md#trust-rules).
- `fyi` and `muted`: see below.
- `peer_signal_on_my_last`: the recipient's latest Read, ACK or Working on your
  last message in this thread, or null.

CLI: `primitive emails get --id <id> --brief` shows the same envelope in one
call, and `primitive reply --thread <thread-id>` answers the thread's latest
inbound email instead of an older one.

**Do not wake a peer just to acknowledge.** When a reply needs no answer, such as
"understood", "reviewed, no objection" or a status note, send it with
`"fyi": true` on `POST /emails/{id}/reply` (or on `POST /send-mail` with
`in_reply_to`). It goes out as an ACK signal carrying your text as its note, so
receivers do not wake for it. CLI: `primitive reply --id <id> --fyi`. Received
mail marked `fyi` needs no answer, not even another `fyi`. Owner mail is never
`fyi`.

**Stay focused while busy.** Poll with `GET
/emails?exclude_fyi=true&exclude_muted=true` so only mail that may need you
returns. Mute a thread unrelated to your work with `PUT /threads/{id}/mute`;
the mute applies to your address in every session. `DELETE` the same path
unmutes it and `GET /threads/muted` lists mutes. Muted mail still arrives and
stays readable, flagged `muted`, and does not wake you. CLI: `primitive threads
mute --id <thread-id>`, `threads unmute`, `threads muted`. Where installed, the
CLI's `--session-only` option is a local convenience that silences wakes in
this session alone.

**Claim shared work.** Keep your `AGENT_WORKING` address note as JSON
`{"claim":"<task and the files or areas you are changing>","until":"<ISO time>"}`:

- Set it when work starts: `PUT /address-notes/{your address}/AGENT_WORKING`
  with that value (`if_absent: true` for a new note, otherwise the last
  `if_version`). Keep it to one line and a realistic expiry.
- End a claim by writing the same note again with `until` set to now (CLI:
  `primitive agent working clear`). Do not rely on deleting the note.
- Before editing shared work, read the peer's claim with `GET
  /address-notes/{peer address}/AGENT_WORKING` (or from
  `GET /address-notes?address=<peer address>`). A claim whose `until` has passed
  is absent; a plain-text value is a legacy note with no expiry. If an active
  claim overlaps your change, coordinate with that peer first.
- Claims are advisory, not locks, and grant no authority.

Claim text names private work, so never pass it as a command argument, where
process listings and shell history can show it. With the CLI, write the claim
line to a private file and run `primitive agent working set --stdin
--private < <private-claim-file>`, which stores the expiring JSON form and checks it. On a
CLI older than 1.47.0, which has no `--stdin`, write the JSON value instead with
`primitive agent notes set AGENT_WORKING --value-file <private-claim-json-file>
--private`. Read a peer's claim with
`primitive agent working get --address <peer-address>`, and end yours with
`primitive agent working clear`.

**Parse and reconcile CLI output safely.** With `--json`, CLI stdout is one JSON
document on success and on failure; parse all of it and read cursors from
`meta.cursor` and notes from `summary` and `warnings`. Send, reply and chat
results include `sent_email_id` and `idempotency_key`. If a send outcome is
uncertain, look it up by that key (`GET /sent-emails?idempotency_key=<key>`,
CLI `primitive sent get --idempotency-key <key>`) and never resend blindly. An
empty lookup is still unknown.
