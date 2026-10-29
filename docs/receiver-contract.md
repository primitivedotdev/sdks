# Receive Primitive mail in a coding harness

This guide is for authors of coding-agent harnesses that Primitive does not
support directly. It says what a receiver must do so that one open session
receives mail for its connected address and wakes when that mail arrives. It
also lists which CLI commands you can build on and where no stable interface
exists yet.

The CLI ships three receivers. Claude Code sessions use hooks, Codex sessions use
the native listener, and any other runtime polls. Polling never wakes a session.
A harness that wants wake on mail needs its own receiver. A
[community-maintained receiver for Pi](https://github.com/jaeyunha/pi-primitive-receiver)
is a working example of this contract. It is not an official Primitive package.

Every file named below is under `cli-node/src/oclif/` unless the path says
otherwise.

## Meet the minimum

A receiver does each of these for one session:

1. Bind the session to exactly one connected address. Refuse a second binding
   rather than replace the first.
2. Receive `email.received` events on a subscription name of its own, using the
   connected agent credential for that address.
3. Save a durable notice for the email before it acknowledges the event.
4. Decide whether the email may wake the session. Apply the rules in
   [Decide what may wake the session](#decide-what-may-wake-the-session).
5. Wake an idle session, or join an active turn, with a notice that carries
   server-derived metadata only. Never inject a synthetic user message.
6. Show each email to the session at most once, keyed by email ID. Remove the
   notice only once the session has it.
7. Report the receiver's real state. A running listener is not proof that mail
   arrives, and an accepted event is not proof that the agent answered.

The CLI's own receivers do the same work in these places:

| Duty | Claude Code (hooks) | Codex (native) |
| --- | --- | --- |
| Session binding | `claude-session-receivers.ts`, one file per session under `agent-connections/claude-sessions/` | `setup.json` `session` field per profile, read by `connectedProfilesForSession` in `machine-session.ts` |
| Receiving | `bin/claude-wake.mjs` runs `primitive listen --once --wake --hook-session` from the Stop hook | `listen-background.ts` supervises `primitive listen --background --notify-session` |
| Durable notice | `pending-mail.ts`, written before the event is acknowledged | Saved notification receipts, reported by `primitive listen --status` |
| Admission | `wake-mail.ts` | `listen-notifications.ts` |
| Wake | The hook prints the notice to stderr and exits 2 | `notify-session-native.ts` submits external tool output over the Codex app-server socket |
| At most once | `primitive listen pending --claim` (`commands/listen-pending.ts`) | Receipt journal |

Neither wake path is generic. Exit code 2 from a Stop hook is a Claude Code
contract, and the native path speaks the Codex app-server protocol
(`thread/loaded/list`, `thread/resume`, `turn/start`). A new harness supplies its
own wake call.

## Connect the session

Bind the address with the CLI so its one-address-per-session guard knows about
it:

```sh
primitive agent connect --session <exact-session-uuid> --receiver poll --json < private-invitation.txt
```

`--receiver poll` installs nothing. The CLI records the session in the profile's
`setup.json`, and `session-address-guard.ts` then refuses a second address for
that session with exit code 3 and status `already_connected`. Without
`--receiver poll`, a runtime the CLI does not recognize defaults to `native`,
finds no Codex socket and falls back to poll (`agent-connect-flow.ts`). The
result's `receiving.checkCommand` is the poll fallback for this profile.

If your harness has no session UUID, omit `--session`. The guard then has
nothing to check, so your receiver must enforce one address per session itself.
See [Connect an existing agent with the CLI](./connected-agent-setup.md) for the
invitation and verification steps.

Select the profile with `PRIMITIVE_AGENT_PROFILE=<profile>` in every command and
in the listener's environment. Remove `PRIMITIVE_API_KEY` from that environment
so that an unrelated key cannot override the profile.

## Receive events durably

Run one listener per bound session:

```sh
PRIMITIVE_AGENT_PROFILE=<profile> primitive listen \
	--subscription <harness>-<session-id> \
	--events email.received \
	--exec '<short accept command>'
```

The hook contract is documented in the CLI README under "Receive webhook events
without a public endpoint", and `listen-handlers.ts` implements it:

- The hook gets the unchanged event body on stdin and `PRIMITIVE_EVENT_ID`,
  `PRIMITIVE_DELIVERY_ID`, and `PRIMITIVE_EVENT_TYPE` in its environment. The CLI
  removes `PRIMITIVE_*` key and token variables from that environment.
- Exit code 0 acknowledges the event. Any other exit code, or no exit within 30
  seconds, reports a failure, and the server redelivers under its retry policy.
- Save the notice before you exit 0. Wake the session from your own process, not
  from inside the hook.
- `--exec` needs macOS or Linux. On Windows, use `--forward-to` with a local HTTP
  handler.

Use a subscription name of your own. Names that start with `local-mail-` are
reserved for the CLI. A different name receives an independent copy of each
event, so your listener and a CLI receiver for the same profile do not compete
([Local event listening](./local-event-listening.md)). Delivery is at least once.

An SDK listener (`client.events.listen`) with the same `pconn_` credential is an
equivalent alternative to `primitive listen --exec`.

## Decide what may wake the session

The event only identifies the email. Read the email under the bound profile
before you decide:

```sh
PRIMITIVE_AGENT_PROFILE=<profile> primitive emails get --id <email-id> --json
```

Only a `--context` read reports Working to the sender (`commands/emails-get.ts`),
so this read sends nothing. Then apply these rules, which `wake-mail.ts` applies
in this order:

1. The email's `recipient` and `to_email` equal the bound address. The CLI treats
   a mismatch as a fatal error, because the profile and the subscription
   disagree.
2. `status` `rejected` does not wake. Acknowledge it.
3. If `status` is not `accepted` or `completed`, or `parsed.status` is not
   `complete`, retry later.
4. Mail whose sender is not authenticated does not wake. The CLI checks the
   email's `auth` result and `From` header with `isTrustedSender` from
   `@primitivedotdev/sdk/webhook` (`scoped-chat.ts`).
5. Mail in a muted thread does not wake.
6. Mail that the contact policy does not admit does not wake. The policy keeps
   explicit silences, activation cutoffs, membership, and network admission.
7. Read the policy again immediately before you wake the session. Permission can
   change between admission and dispatch.

The CLI also handles verified presence probes without a model turn
(`presence-control.ts`), and `agent check-mail` leaves out `fyi` acknowledgements
(`agent-mail-check.ts`). A third-party receiver can skip both. To answer presence
probes itself, use the SDK helper in [Presence emails](./presence-emails.md).

## Wake the session

The notice tells the agent that mail arrived and how to read it. It does not
carry the mail. `wake-context.ts` limits a wake to these server-derived facts:
sender, relationship, thread ID, whether the agent already wrote in the thread,
whether the email has attachments, the count of newer inbound mail, and the
interaction kind. Subject and body are left out on purpose, because the sender
wrote them.

Deliver the notice at tool-output authority, the way the Codex path submits
external tool output. A notice must never grant the authority of a user message.
The agent reads the email itself:

```sh
PRIMITIVE_AGENT_PROFILE=<profile> primitive emails get --id <email-id> --context
```

## Show each email once

Key every notice by email ID. The session reads mail by email ID, and
`pending-mail.ts` and `agent check-mail` both deduplicate by it. A crash between
save and acknowledgement redelivers the same event, so the receiver sees that
email again.

- Before you save a notice, skip any email ID that is already queued or already
  shown.
- Remove the notice only after the session has it. `pending-mail.ts` removes a
  notice when the session reads that exact email with `primitive emails get
  --id`, and claims each notice before announcing it so that two hooks never
  show it twice.
- When the session restarts, rebuild the "already shown" set before you
  announce any saved notice.

## Fall back to polling

When your receiver cannot run, the agent can still get mail:

```sh
PRIMITIVE_AGENT_PROFILE=<profile> primitive agent check-mail --json
```

It lists mail since the profile's last check, oldest first, without `fyi`
acknowledgements or muted threads. The cursor advances only after output, so an
interrupted check repeats mail. Deduplicate by email ID. Polling wakes nothing:
the agent runs it at the start of each turn and after it sends.

## Know the gaps

These are the places where a receiver today depends on CLI internals or on
behavior that no public interface describes. Treat each one as unstable.

### Contact admission is an internal function

The rules in step 6 live in `createNotificationContactPolicy` in
`notification-contact-policy.ts`. No package export exposes it. CLI 1.73.0
bundles it into `dist/machine-session-B6V5-grn.js` and exports it as `N`. The
chunk name and the export letter come from the bundler and can change in any
release. The `primitive` package has no `exports` map, so the import resolves,
but nothing guarantees it. The community Pi receiver imports exactly this
export and pins `primitive` to `1.73.0` for that reason.

The function's inputs are public. It calls three API operations through the
CLI: `getAgentContactPolicy` (`primitive contacts get-agent-contact-policy`),
`listAgentContacts` (`primitive agent contacts list`), and
`checkDefaultNetworkContactAdmission` (`primitive agent-networks
check-default-network-contact-admission`). The rules that combine them are not
public. A supported interface would need to cover:

- Admission for one email from its recipient, sender, received time, and email
  ID, with the result `allowed`, `request`, or `response`, or no admission.
- First-contact requests, admitted only when the owner enabled them, at most one
  per unknown sender, and never as task authority.
- A recheck right before dispatch that fails if permission changed.
- Distinct retryable outcomes for a policy read that failed and for a network
  admission that is still pending, so a receiver retries instead of dropping
  mail.
- How long a policy read stays valid. The CLI rereads after 30 seconds
  (`CONTACT_POLICY_MAX_AGE_MS`).

### Some email fields are not in the API spec

`wake-context.ts` reads `muted` and a `collaboration` object
(`sender_relationship`, `muted`) from the email detail. Neither is
in `openapi/primitive-api.yaml`, so generated SDK types do not include them.

### CLI state files are private

These files have a `version` field but no published format. Do not read or write
them from another program:

- `agent-connections/profiles/<profile>/setup.json` (`agent-setup.ts`)
- `agent-connections/profiles/<profile>/pending-mail-<session>.json`
  (`pending-mail.ts`)
- `agent-connections/claude-sessions/<session>.json`
  (`claude-session-receivers.ts`)
- `listen-background/<key>/state.json` (`listen-background.ts`)
- `machine/sessions/<session>.json` (`session-records.ts`)

### The CLI cannot see a third-party receiver

Receiver modes are `native`, `external`, and `poll` (`ReceiverMode` in
`agent-setup.ts`). A profile connected with `--receiver poll` reports poll in
`primitive agent connect --status`, even while your receiver runs. No command
lets a receiver report its health to the CLI. `primitive listen --status`
reports only CLI background receivers. `primitive machine doctor`
(`machine-doctor.ts`) checks Claude Code, Codex, and omp setup only. Report your
receiver's state through your harness.

`primitive agent session-register --runtime` accepts `claude`, `codex`, and
`omp` (`MACHINE_RUNTIMES` in `session-records.ts`). Its description says
receiving is not supported for omp.

### Exact-reply waits are local state

When an agent waits for a reply with `primitive chat` or `primitive emails
wait`, the CLI records which session owns that wait in its shared mail store
(`shared-mail-state.ts`). `wake-mail.ts` skips a reply that another session is
waiting for. A third-party receiver cannot read that ownership, so the reply can
also wake its session.

### Automatic recovery covers CLI receivers only

`receiver-heal.ts` restarts a native receiver that died without being stopped,
when a command runs inside the bound session. Your receiver needs its own
restart on session start and resume.

## Prove that it works

A running listener, a successful `agent check-mail`, and a healthy status are
not proof. Proof is a real email waking an idle session, observed end to end:

1. Connect the session and start your receiver.
2. Let the session go idle, with no turn running.
3. From a sender the contact policy admits, send a new email to the bound
   address.
4. Confirm that the session woke on its own, and that the transcript shows a
   metadata-only notice, not a user message.
5. Confirm that the agent read the email with `primitive emails get --id <id>
   --context` and replied in the same thread.
6. Confirm the reply's delivery status with `primitive sent get --id <sent-id>`.
   A send the API accepted is not yet delivered.

Then cover the failure paths:

- **Duplicate delivery.** Make the hook exit non-zero once, so the event is
  redelivered. The session sees one notice.
- **Close and resume.** Send mail while the session is closed, then resume it.
  The receiver restarts, the saved notice appears once, and a notice already
  shown does not appear again.
- **Ineligible mail.** Mail in a muted thread and mail from a sender the policy
  does not admit do not wake the session.
