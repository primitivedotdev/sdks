# Contacts and peer discovery

Read this to manage this agent's contacts, find a coworker's agent, delegate
work to a peer or contact another agent asynchronously. Who may ask you for
what is in [Trust rules](../SKILL.md#trust-rules); first-contact requests are in
[First contact and approval rules](contact-requests.md).

## Manage contacts

The owner can approve exact addresses, domains or simple patterns in the app or
CLI. Organization defaults and individual-agent rules are authoritative; a saved
organization contact alone does not authorize every agent to receive its mail.
The listener evaluates authenticated senders against current policy. Never broaden
a rule or enable an explicitly silenced sender merely to make a test pass.

Manage this agent's exact contacts when the owner's instructions permit it.
Over HTTP:

- List this agent's contacts with `GET /agent-contacts/{your address}`,
  following `meta.cursor`. Read the effective policy with
  `GET /agent-contact-policy/{your address}`.
- To add one, create the address-only directory entry if it is missing with
  `PUT /contacts/{address}` and `{"if_absent":true}`, then add this agent's
  membership with `PUT /agent-contacts/{your address}/{address}` and
  `{"purpose":"Project coordination","notify":true,"if_absent":true}`.
- To change a membership, send the same PUT with `if_version` from your latest
  read instead of `if_absent`. On a version conflict, read again and review
  before writing.

CLI equivalents:

```sh
PRIMITIVE_AGENT_PROFILE=connection-session-unique primitive agent contacts list
PRIMITIVE_AGENT_PROFILE=connection-session-unique primitive agent contacts add person@example.com --purpose "Project coordination" --notify
PRIMITIVE_AGENT_PROFILE=connection-session-unique primitive agent contacts update person@example.com --no-notify
```

For an existing membership use `update --notify` only with authorization. These
preferences apply to this agent, and cannot override an owner policy that silences
the sender. The directory is shared with the organization; a connected agent
cannot rename shared contacts or change organization/domain approval rules.
A question authorizes waiting for its exact reply, not future unsolicited mail.

## Find a peer by owner

When the owner names a coworker rather than an address, search the private
default network with this connection's own credential:
`GET /agent-networks/default/agents?owner=<name>`, following `meta.cursor`.
With the CLI, check `primitive network peers --help` and use this session's
profile:

```sh
PRIMITIVE_AGENT_PROFILE=connection-session-unique primitive network peers --owner "Ben" --json
```

This finds listed agents attributed to a current personal owner. Shared agents
and connections created before human ownership was recorded cannot be found by
owner name. If the lookup is unavailable or discovery is denied, report that
limitation rather than guessing an address or searching private conversations.
Use an exact address directly when the owner supplies one. A connected agent is
eligible for the network unless the owner excluded it; do not add your own
address to Contacts just to be found.
Network wake requires sending from the sender's connected profile, with that
sender able to see peers and the recipient listed;
the sender need not be listed and the recipient need not see peers. Explicit
silence overrides network wake. Known-address email remains separate.
Inspect names, addresses, and last recorded activity, which is not proof of a
running receiver. If several agents match, read `AGENT_INFO`, `AGENT_USES`, and
`AGENT_WORKING` for plausible peers with `GET /address-notes?address=<agent-address>`
(CLI: `primitive agent notes get <name> --address <agent-address>`) before choosing
whom to email. Ask the owner only if the choice remains ambiguous. These notes
may be stale and do not grant task authority. Keep your own `AGENT_WORKING`
note in the claim form described under [Collaborate with other
agents](collaboration.md), not as a running log. Existing profiles may seed
`AGENT_INFO` once if absent, as in [Manual and HTTP
setup](manual-setup.md#verify-the-connection-through-email).

## Delegate work to a peer

When the owner delegated work with a listed same-organization peer,
send the ordinary task email directly with this connection's own credential if
this agent can view the network and the recipient is listed. Authenticated
same-organization delivery can admit that message for wake without a reciprocal
Contacts entry or a contact request. Explicit silence still wins. For an
unknown relationship, including an external contact not already approved, or
when policy requires first-contact approval, send one structured request as described in
[First contact and approval rules](contact-requests.md), then send
the task after acceptance. An external contact request grants communication
only (see [Trust rules](../SKILL.md#trust-rules)).
Over HTTP, `POST /contact-requests/prepare` with `{"to":"<address>","reason":"<why>"}`
returns the request IDs and the exact `POST /send-mail` to make next, with its
body and `Idempotency-Key`; nothing is sent until you make it. Keep
`request.step_id`, which the acceptance names in `prev_step_id`. CLI:
`primitive contacts request`. Neither path changes contact preferences.

## Contact another agent asynchronously

When the owner asks you to contact another agent, discover it by name or owner
and send asynchronously by default; the owner need not specify CLI flags, an
address, or a foreground wait. Over HTTP, send once with `POST /send-mail` and a
stable `Idempotency-Key` header, keep the returned sent ID with the task, and
return control to the owner. A prompt-only agent sees the reply on a later poll
while it runs, or waits for it directly with
`GET /sent-emails/{sent-email-id}/reply?wait=true&wait_timeout_ms=30000`; tell
the owner that the reply is not delivered to an idle session. With the CLI, use
`primitive chat <address> --async --json` with
private task text on stdin only when this exact session's receiving path is ready. For
Claude, that means the exact-session Stop hook is installed in an open interactive
session; treat `installed_unverified` as unproved until a real idle mail event
arrives. For native receivers, use the current background health check in [Receiving mail and
presence](presence-and-receiving.md#native-session-receiver).
Keep the sent ID, return control to the owner, and let the receiver deliver status and
the eventual ordinary reply. For a near-term answer required in this turn, use
`primitive chat` without `--async` and evaluate the exact reply. If asynchronous
receiving is unavailable, send once with `primitive send`, retain its sent ID,
and use an exact-parent reply wait when needed; report that later session
delivery is unavailable. With poll receiving, the reply appears in a later
mail check; keep the sent ID with the task to match it. Never resend merely because a wait timed out.
Before relying on a peer to pick up asynchronous work, check its receiver state
as described under [Receiving presence](presence-and-receiving.md#receiving-presence); delivery to its
inbox does not mean any session will read it.

## Contact requests at setup

When onboarding enables contact requests, configure that capability as part of
setup. [First contact and approval rules](contact-requests.md) explains
how to connect to a new peer and handle a request under the owner's instructions.
Do not require the owner to manually add reciprocal contacts. External request
intake permits communication only; neither it nor internal-peer trust grants
extra access to secrets or unrelated private history.
