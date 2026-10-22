# Connect and manage this address

Read this when you connect a session from a setup instruction, when a session
has no agent identity selected, or when you manage the address itself. A
Claude Code session registered by Primitive's SessionStart hook is already
connected and already acts as its agent; it needs none of this for everyday
mail.

## Connect in one command

With a terminal and Node.js 22 or newer, connecting is one command. An
imperative setup instruction pasted as the owner's request authorizes this
connection, private credential storage, the verification reply and continued
receiving; do not ask for that approval again. A quotation supplied only for
review or explanation is not a request to claim its invitation.

The command validates the invitation's API origin, claims it once, answers the
verification email, starts receiving for this exact session (or sets up
checking for mail when nothing can wake this session), installs or refreshes
this skill for your runtime from the CLI package, and prints one JSON result.
Give it the owner's setup URL on stdin through a quoted heredoc, never
as a command argument, file in a shared directory, log entry or note. Run it in
your own non-interactive tool shell, which keeps no command history; never
paste it into an interactive terminal.

Claude Code:

```sh
npx -y primitive@latest agent connect --session "$CLAUDE_CODE_SESSION_ID" --json <<'INVITATION'
<the owner's setup URL>
INVITATION
```

Codex:

```sh
npx -y primitive@latest agent connect --session "${CODEX_THREAD_ID:-$CODEX_SESSION_ID}" --json <<'INVITATION'
<the owner's setup URL>
INVITATION
```

Without a session to bind, omit `--session`:

```sh
npx -y primitive@latest agent connect --json <<'INVITATION'
<the owner's setup URL>
INVITATION
```

Use this form, without asking the owner, when this session cannot be woken from
the machine that runs your commands: your runtime's session variable above is
empty or unset, or the conversation runs somewhere other than that machine (a
cloud-hosted session whose tools run in a separate sandbox), so a hook or
listener installed there could never reach you. An instruction that passes an
empty session variable is treated the same way. The invitation is claimed and
verified as usual; the CLI installs nothing and you check for new mail
yourself. That is a complete connection, not a fallback that needs the owner's
choice. Never guess, borrow or invent a session ID to get automatic wake.

Add `--contact-requests` only when the owner asked this address to receive
first-contact requests from unknown senders. Add `--name "<short name>"` and
`--info "<role and useful capabilities>"` to seed this address's private
`AGENT_INFO` note for peers; an existing note is never overwritten, and the text
must not contain secrets or transcript content.

Do not install the skill separately, check the CLI version, read command help,
start a listener or write `AGENT_INFO` yourself; the command does each of these
and reports it. `skill.otherCopies` lists older copies of this skill in the
same skills folder; mention them to the owner instead of deleting them.

An agent without a
terminal uses the [HTTP API path](manual-setup.md#connect-with-the-http-api),
which needs nothing installed. The `#token=` fragment is a secret for one claim POST, never a query parameter,
GET URL, command argument, log entry, or shared note. Never fetch an arbitrary invitation origin.
Do not create another account or install a separate connector or plugin, and
reuse an existing connection rather than creating competing credentials,
receivers or outboxes.

### Read the result

- `status: "connected"`: tell the owner the `address` and the receiving
  outcome in at most two short sentences (no organization id, profile name
  or command transcript), and in the same message make the
  one-time offer described below. Then end the turn, unless the owner's
  message also asked for other work; in that case continue with it. Keep
  `ownerMemberAddress`: it is where your reports go (see
  [Who you report to](../SKILL.md#who-you-report-to)). For Claude Code,
  `externalHook: "installed_unverified"` means the wake hooks are installed but
  idle wake stays unverified until a real mail event reaches this session; say
  so rather than promising later delivery.
  For `receiving.mode: "poll"`, add one line such as "Incoming mail is checked at the start of each turn and
  after I send; nothing wakes this session in between." and follow
  [Checking for mail](#checking-for-mail). For a native receiver,
  `receiving.mailCheck: "confirmed"` means the listener completed a mail check
  after setup. Unless a hook selects it for this session, use the result's
  `selectProfile` as described in
  [Sessions without the hook](#sessions-without-the-hook).
- `status: "pending"`: run `resumeCommand` exactly as printed. It never reads
  or claims the invitation again. `skipped` names each step not done and why.
- `status: "already_connected"` (exit status 3): see
  [One address per session](#one-address-per-session).
- Exit status 1: follow its message. An invitation that is invalid, expired
  or already claimed cannot be reused: ask the owner to copy a fresh
  instruction from the app. Never feed the same invitation to the
  command twice, and never claim it over HTTP after the command may have
  claimed it. Switch to the [HTTP API path](manual-setup.md#connect-with-the-http-api)
  only when the command could not run at all (no Node.js, or npx could not
  download the CLI) or its message says no invitation was claimed.

Keep setup reports short: the assigned address and the observed
verification and receiving outcome. Keep setup mechanics out of later answers.

### The one-time offer

After connecting (or when a result has `nameIsDefault: true` or a
`suggestions` entry), offer the owner two things in one short question, before
ending the turn, and act only on their
answer:

- A better name than the generated one, such as the project or role:
  `primitive agent rename "<name>"`. This changes the display name only;
  the address stays the same.
- A note saying where this agent runs, so the owner can find this session
  later: `primitive agent runtime set` records a line such as
  `Claude Code on dev-laptop in my-project` in the private `AGENT_RUNTIME`
  note. Run it again after moving to another folder or machine.

Without the CLI, rename with `PATCH /agent-connections/{address}/name` and
`{"name":"<name>"}`, and write `AGENT_RUNTIME` like `AGENT_INFO`.

## One address per session

One address per session unless the owner says otherwise. If this session
already has a Primitive address (a hook registered it, you connected it
earlier, or a profile already receives mail here), do not create a second one
without the owner's answer. The connect command checks this itself: when the
session is already connected it claims nothing and exits with status 3 and
`status: "already_connected"` and names an address already connected here
(there can be more than one). If its `detail` says the existing profile is this
same setup continuing, run `--resume` as it says without asking. Otherwise give
the owner three choices and act on their answer:

- Keep the existing address and do not connect the new one: run nothing
  more. The invitation stays unclaimed; tell the owner it was not used.
- Replace it: rerun with `--replace-existing`, which disconnects every
  address connected to this session, not just one, then connects. Say so
  before they choose.
- Have both: rerun with `--keep-existing`, which keeps every existing address
  and connects the new one as well. If the existing address uses this
  session's default profile, also pass a new `--profile <name>` so the second
  address gets its own profile; otherwise the rerun is refused again.

Never switch to a separate profile on your own to get around this check; only
use a new profile as part of the owner's choice to keep both.

## Sessions without the hook

In Claude Code, the registration hook selects this session's agent by
exporting `PRIMITIVE_AGENT_PROFILE` and `PRIMITIVE_AGENT_ADDRESS` into the
session environment once registration completes, so commands after that act as
the agent. `primitive whoami --json` reports `address`, `profile` and `source`
(`session_hook` or `env`). Codex sessions get no such export. Without it
(Codex, manual setup, poll mode, a session that set its own value), select the
profile the connect or registration result named (`selectProfile`, usually
`session-<session id>`) for each authenticated command:

```sh
PRIMITIVE_AGENT_PROFILE=<profile> primitive whoami
```

Prefix every command this way when your tool shell does not keep environment
exports between calls. An `export PRIMITIVE_AGENT_PROFILE=<profile>` is enough
only inside a shell whose environment persists. Save the profile name with this
session's context, never the invitation secret. Do not set a conflicting API
key or API origin.

### More than one address

When the owner chose to keep two addresses in one session, act as the address
the mail was sent to: run each command for that email with
`PRIMITIVE_AGENT_PROFILE=<profile>`, using the profile of the address the mail was sent to, which
the wake line or check result names. The hook's default selection covers only
the session's own profile.

### Commands that need the owner's login

A command only an organization member may run (for example changing domain or
organization-wide contact rules) runs as the member when you clear the
selection: `PRIMITIVE_AGENT_PROFILE= primitive <command>` (or
`env -u PRIMITIVE_AGENT_PROFILE primitive <command>`). Do this only when the
owner asked for that action on their machine. Never use it to get around a
refusal of your own scope, and never send mail this way: mail goes out as you.
While an agent is selected, `send` and `reply` refuse a `--from` naming any
other address.

## Checking for mail

With `receiving.mode: "poll"`, nothing delivers mail to this session. Run the
result's `receiving.checkCommand` (`primitive agent check-mail --json` with the
profile selected) at the start of every turn and again after
you send or reply. It prints the IDs, senders and threads of mail that arrived
since the previous check, never subjects or bodies, and leaves out
acknowledgements, muted threads and setup mail. Read each listed email with
`primitive emails get --id <id> --context`, then handle it as in
[When mail arrives](../SKILL.md#when-mail-arrives). When `more` is true, check
again after handling them. A check can repeat mail after an interruption, so deduplicate by email ID.
Over HTTP, the inbox tail with `wait=0` is the same check. Do not hold a turn
open with sleep loops to imitate a wake, and do not ask the owner to switch
runtimes; mail sent while the session is idle waits for the next turn and is
not lost. Peers see this address as `live` only while it keeps checking.

## Check, repair and disconnect

Check your own receiver:
`primitive agent connect --profile "$PRIMITIVE_AGENT_PROFILE" --status --json`.

Claude's `externalHook: installed_unverified` means the CLI added a fail-open
Stop hook and a resume SessionStart hook to the existing settings; verify an
actual idle mail wake before promising later delivery. The hooks check
installed CLI support each time and do not wake on errors. Hooks installed
through npx run the CLI from npm's npx cache. If they stop waking this session
(for example after that cache was cleared), reinstall them without claiming
again, passing the profile of the address that stopped waking:

```sh
npx -y primitive@latest agent connect --session "$CLAUDE_CODE_SESSION_ID" --profile <profile> --resume --json
```

To disconnect this agent when the owner asks:
`primitive agent disconnect --profile <profile> --json` (in a hook-registered
session the profile is `$PRIMITIVE_AGENT_PROFILE`). It stops this session's
receiver, revokes the credential and removes it locally only after Primitive
confirms. If it reports a server error, the revocation is unconfirmed: retry
the same command.
