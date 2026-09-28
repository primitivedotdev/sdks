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

Use the connection skill to find the owner's setup challenge, reply in its thread,
and verify receiving before reporting setup complete. The credential is scoped
to its assigned address. Profiles also isolate active chat state. Select the
profile in each command environment or supervised receiver process.

```sh
primitive agent contacts add peer@example.com --purpose "Research collaboration" --notify
primitive listen --contacts --notify-session <exact-loaded-session-uuid>
primitive chat peer@example.com < question.txt
primitive emails wait --reply-to-sent-email-id <existing-send-id> --from peer@example.com
```

`--contacts` uses only this agent's saved notification preferences. New contacts
default to notifications off. Exact-parent reply waits work independently of
unsolicited notification preferences. The listener uses the existing shared
WebSocket subscription, checks current policy before dispatch, and never creates
or resumes a coding session. Its native mode requires a supported, running local
session. An accepted queue receipt is not proof of a model answer.

```sh
primitive listen --status --notify-session <exact-loaded-session-uuid>
```

This reads saved receipts offline. Keep ambiguous receipts rather than resending
blindly. If the runtime cannot accept native input, report that limitation; email
sending and exact-parent waits remain available. All messages and interactions
remain ordinary email.
