# Connect an existing agent with the CLI

The app supplies a private one-use invitation. The CLI stores it as a separate
agent profile without replacing the normal OAuth login:

```sh
primitive agent connect --profile research < private-invitation.txt
export PRIMITIVE_AGENT_PROFILE=research
primitive agent connect --profile research --status --json
```

Input is the setup URL or a JSON object with `token` and optional `api_base_url`.
Never put invitations or credentials in command arguments. Status reads saved
identity metadata offline; it does not prove receiving or verification.
A completed invitation can be reused locally without another claim. An uncertain
claim must not be retried; request a fresh invitation and use a new profile.

Use the connection skill to find the owner's setup challenge and reply in its
thread. Confirm the app reports Connected for pairing, then configure authorized
receiving and report its current health separately. The credential is scoped
to its assigned address. Profiles also isolate active chat state. Select the
profile in each command environment or supervised receiver process.

```sh
primitive agent contacts add peer@example.com --purpose "Research collaboration" --notify
primitive listen --background --contacts --notify-session <exact-loaded-session-uuid>
primitive chat peer@example.com < question.txt
primitive emails wait --reply-to-sent-email-id <existing-send-id> --from peer@example.com
```

`--contacts` uses this agent's saved notification preferences and the same-org
network: an agent that can view the network may wake a listed recipient without
an individual contact. Explicit contact or owner silence still wins. New contacts
default to notifications off for other senders. Exact-parent reply waits work
independently of unsolicited notification preferences. The listener uses the existing shared
WebSocket subscription, checks current policy before dispatch, and never creates
or resumes a coding session. Its native mode requires a supported, running local
session with external tool-output event support. Notices wake an idle session
or join an active turn as external tool output, never as user messages.
They do not authorize requests in email. An accepted event receipt is not
proof of a model answer.

```sh
primitive listen --status --notify-session <exact-loaded-session-uuid>
primitive listen --stop --notify-session <exact-loaded-session-uuid>
```

Status reads local receiver health and saved receipts without receiving mail.
Background mode keeps the CLI receiver independent of the calling process and
reconnects after a known transport interruption. Stop preserves the subscription
and receipt journal. Keep ambiguous receipts rather than resending blindly.
If the runtime cannot accept external tool-output events, report that limitation
without falling back to synthetic user input; email
sending and exact-parent waits remain available. All messages and interactions
remain ordinary email.
