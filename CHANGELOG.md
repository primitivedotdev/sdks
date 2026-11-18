# Changelog

Release notes for the packages in this repository:

- Node SDK: `@primitivedotdev/sdk`
- Node CLI: `primitive` (and its mirrors `primcli` and `@primitivedotdev/cli`)
- Python SDK: `primitivedotdev`
- Go SDK: `github.com/primitivedotdev/sdks/sdk-go/v3`

From 3.0.0 all four share one version, because all four are generated from
the same OpenAPI spec. See `RELEASE.md`.

## 3.0.0

`openapi/primitive-api.yaml` is now produced by `make openapi-sync` from the
OpenAPI document the API serves, and every client is regenerated from it. Most
of the changes below follow from that document.

Previous versions: Node SDK, Python SDK and Go SDK 2.7.1; CLI 1.75.0. The preview of this release is `3.0.0-preview.21` for `primitive` and `@primitivedotdev/sdk` (npm `preview` dist-tag) and for the Go module (`sdk-go/v3.0.0-preview.21`), and `3.0.0rc21` for `primitivedotdev` on PyPI. It follows `3.0.0-preview.20` (`3.0.0rc20`), which put `decided_at` on rule decisions, added close calls, look-alike groups, version changes on rule tests, webhook request headers and URL warnings, the attachment reading setting and the `listEmailRules` filters, and stopped a CLI command missing a required request field before any request, `3.0.0-preview.19` (`3.0.0rc19`), which added the CLI domain focus and the `domain_ids` mail filter and limited email rules to mail on the mail relay domains, `3.0.0-preview.18` (`3.0.0rc18`), which printed the API's response body under `--json`, gave CLI errors a code, reshaped the compile answer into the body rule writes take, put one expectations gate on rule writes, dropped the prose notes from rule answers, listed your own sends by default in `sent list`, required event types on a new webhook and added `primitive skills install`, `3.0.0-preview.17` (`3.0.0rc17`), which set the email rule and key fields and stopped promising `receivers_changed` notices, `3.0.0-preview.16` (`3.0.0rc16`), which kept a rule's share across a new version and added attachment names on rule tests, compile scope warnings, labelled sample details on judged writes, `stopped` coverage notices, the mail a rule test covered and the emails it matched, `--same-emails-as`, text length checks before sending and the API's message on a refused send, and printed webhook URLs as stored again, `3.0.0-preview.15` (`3.0.0rc15`), which added `rule_deliveries` on email reads, protection on sample tests, tests of a pending rule request, the test window's scope and compile's breadth scope, `existing` on an idempotent rule request, the successor's details on key rotation, `outside_scope` as a reason a rule did not run, `do_not_share_note` on grant rules and `rule_now` on coverage notices, `3.0.0-preview.14` (`3.0.0rc14`), which added email notification settings in the SDKs, `receivers_changed` coverage notices with their totals, webhook URL query strings hidden in endpoint output and activity read retries, `3.0.0-preview.13` (`3.0.0rc13`), which added email detail attachments, attachment names on made-up emails, compile scope, rule share and objection notices, objection box `mine` and the mail import operations, `3.0.0-preview.12` (`3.0.0rc12`), which added imported mail, pending coverage rows, endpoint and key warnings and the default check of writes to rules that keys or webhooks read, `3.0.0-preview.11` (`3.0.0rc11`), which added server notes on rule requests, rule receivers, `activity concerning` and the rule objection webhook events, `3.0.0-preview.10` (`3.0.0rc10`), which added email rule objections, the email rule scope flags and true or false on boolean flags, `3.0.0-preview.9` (`3.0.0rc9`), which added email rule oversight and look-alikes that carry `expected`, and changed what `hidden` counts on rule results, `3.0.0-preview.8` (`3.0.0rc8`), which added look-alikes, made-up emails kept as a rule's expectations and do-not-share rules created active, `3.0.0-preview.7` (`3.0.0rc7`), which had the server refuse a failing rule update and added rule revisions, reach and breadth, `3.0.0-preview.6` (`3.0.0rc6`), which added key expiry and rule changes to `keys update` and the email rule request webhook events, `3.0.0-preview.5` (`3.0.0rc5`), which took send's default From from the API and added `primitive activity created`, `3.0.0-preview.4` (`3.0.0rc4`), which added expectations to email rule authoring, `3.0.0-preview.3` (`3.0.0rc3`), `3.0.0-preview.2` (`3.0.0rc2`) and `3.0.0-preview.1` (`3.0.0rc1`).

What `3.0.0-preview.21` (`3.0.0rc21`) changes from `3.0.0-preview.20`:

API and SDKs, breaking:

- These fields are now required in the generated types, each nullable:
  `rule_name` and `accept_changes` on a rule share, and `accepted_english`
  on a rule request and on the results of `createEmailRuleRequest`,
  `getEmailRuleRequest`, `declineEmailRuleRequest` and
  `withdrawEmailRuleRequest`. In Python, models built with positional
  arguments see the new fields in their spec order.
- The error code `email_rule_request_not_withdrawn` is replaced by
  `email_rule_request_not_deletable`: `deleteEmailRuleRequest` answers it
  for a request that is pending (withdraw it first) or accepted
  (`details.status`).

API and SDKs, added:

- A rule share carries `rule_name`: the rule's current name while the share
  is live, and its name when the share ended once it has, also after the
  rule is deleted. It carries `accept_changes` (`requested_english` and
  `accepted_english`) when the rule was edited on accept, for the member
  sharing their mail and the member it is shared with.
- The member a rule share is with keeps seeing `granter.email` after the
  share ends.
- A rule request carries `accepted_english`, the English that was accepted
  when it was accepted with changes, for the member who asked and the
  member asked. `english` stays what was asked for.
- A rule covering your mail (`listEmailRulesCoveringMe`,
  `getEmailRuleCoveringMe`) names its author's `email`, null only when they
  have none.
- `deleteEmailRuleRequest` deletes a declined request as well as a
  withdrawn one.
- `listActivityObjects` lists deleted email rules, and with
  `relation=concerning` the coverage notice `activated`: a rule you were
  told of while it was in observe is now active. A `started` notice now
  comes for a rule in observe as well as an active one; only a draft rule
  is not told of. A `stopped` notice's `turned_off` means the rule was set
  to draft, and a rule moved from active back to observe still covers you
  and is not stopped.
- `deleteEmailRule` keeps the rule only as deleted: nothing reads or
  changes it again, it grants no access, and it is listed only in its
  author's activity. A share's `rule` is null once the rule is deleted,
  and `rule_name` stays.
- The `domain_ids` filter of `listEmails`, `searchEmails` and
  `semanticSearch` matches a domain by name within the organization, so
  mail stored under an earlier record of a domain that was deleted and
  added again is included.

CLI, breaking:

- Command paths use shorter names, such as `primitive email-rules create`
  (was `email-rules create-email-rule`), `primitive account get` (was
  `account get-account`) and `primitive org list` (was `orgs`). Verbs are
  the same across commands: `routes add` and `routes remove` are
  `routes create` and `routes delete`, `contacts add` and
  `contacts remove` (also under `agent contacts`) are `create` and
  `delete`, `org secrets remove` is `org secrets delete`, `domains add` is
  `domains create`, `account show` is `account get`, `functions
  route-get`, `route-set` and `route-unset` are `get-route`, `set-route`
  and `unset-route`, `search semantic-search` is `semantic-search`, and
  `sending delete-sent-email` is `sent delete`. A removed
  spelling does not run: it exits 2 with error code `command_not_found` and
  names its replacement, in `error.details.suggestions` under `--json`.
  Help, discovery and completion use the new paths. API operation names,
  routes, request fields and SDK methods are unchanged.
- Email rule commands take `--scope`, `--samples-file` and
  `--add-samples-file` in place of `--evaluation-scope`,
  `--expectation-samples-file` and `--add-expectation-samples-file`. An
  old flag is refused with the new one as its suggestion.
  `--expect-samples-file` is unchanged.
- Positional arguments are read only from the command line. Piped stdin no
  longer fills in a missing argument such as an id; only a command that
  takes a body, secret or hook input from stdin reads it.
- `activity created`, `asked` and `concerning` with `--json` print
  `{data, meta}`: the rows in `data`, and `covers`, `withheld` and the next
  page's `cursor` in `meta`. They printed `covers`, `items`, `withheld` and
  `next_cursor` at the top level.
- Without `--json`, `sent list` and `sending list` print a table on
  stdout. Before, stdout had the JSON and the table followed on stderr.
  `--json` output is unchanged.
- `org list`, `org use` and `login` show a `restricted` role as `built-in
  role member`, with a note that the label can also mean a template or
  custom role that does not fully include member (and, in `org list`, no
  role at all), and that it does not grant member permissions. `org list --json` and
  `org use --json` report that `role` as `member`.

CLI, added:

- `primitive activity concerning` describes the `activated` notice and
  notices for rules in observe, and shows `turned_off` as set to draft.
- `email-rules delete-request` help says it takes a withdrawn or declined
  request.

What `3.0.0-preview.20` (`3.0.0rc20`) changes from `3.0.0-preview.19`:

API and SDKs, breaking:

- Email rule decisions carry `decided_at`, when the rule made the decision,
  in place of `created_at`, on `listEmailRuleDecisions` and
  `listEmailRuleDecisionsOnMyMail`. In Python the field is `decided_at` and
  in Go `DecidedAt`.
- These fields are now required in the generated types: `close_call` on
  each expectation result and judged made-up email of a rule test, and on
  each look-alike; `close_calls` in the test's expectation counts and the
  look-alike counts; `close_calls` and `close_call_samples` on a write's
  `expectations_check`; `group` on each look-alike and `by_group` in the
  look-alike counts; `recipient` on both decision listings; `rules` on
  `DeliverySummary` and `getDelivery`'s result; `description` on each of
  `getEmail`'s top-level `attachments`; `checked` on a rule share's
  `activity`. In Python, models built with positional arguments see the new
  fields in their spec order.
- `getEmail`'s top-level `attachments` are `EmailDetailAttachment`
  (`EmailAttachment` with `description`), in Python and Go. In Go
  `EmailDetail.Attachments` is `[]EmailDetailAttachment`.
- In Python and Go, the made-up emails `testEmailRule`'s `expect.samples`
  takes are `EmailRuleTestSampleInput` (was
  `EmailRuleExpectationSampleInput`), which takes an optional `group`.
  `EmailRuleExpectationSampleInput` stays the type of a rule's saved
  `expectation_samples` and `add_expectation_samples`, which take no group.

API and SDKs, added:

- `testEmailRule` answers `changes` (`EmailRuleVersionChanges`) for a tree
  given with `rule_id` when the rule has a current version: the emails the
  tree newly matches and stops matching against that version (newly
  withheld and no longer withheld for a do_not_share rule), each a `count`
  and up to 50 emails newest first, and how many were `undecided`.
  `compared_to` is `version`, with `compared_to_version`.
- `testEmailRule` takes `tree` with `request_id`: your edit of a pending
  request's rule (with it, only `english` and `kind` `grant`). For a tree
  other than the one asked, `changes` compares it with the request's rule
  as asked (`compared_to` `requested`).
- Close calls: an expectation, made-up email or look-alike passed or failed
  on an answer below 0.75 confidence carries `close_call`, since judged
  again it may come out the other way. The counts carry `close_calls`, and
  a write's `expectations_check` carries `close_calls` (emails by id) and
  `close_call_samples`.
- Look-alike groups: each look-alike carries `group` (`private`,
  `near_miss` or `must_match`) and the look-alike counts carry `by_group`.
  A made-up email sent in a test's `expect.samples` takes the same `group`,
  and the test's expectation counts then carry `by_group` for the samples.
- `generateLookAlikes` takes the `legal` and `personal_correspondence`
  kinds, and `kinds` takes up to 7.
- `listEmailRuleDecisions` and `listEmailRuleDecisionsOnMyMail` carry each
  email's `recipient`, the mailbox it was received in.
- `listEmailRules` takes `all` (`"true"`: every rule in the organization,
  any author, for owners and admins), `author` (a user id or member
  address), `mailbox` (rules whose scope reaches it now), `kind` and
  `state`. With `all`, each rule carries `receivers`. The list is ordered
  most recently changed first.
- `getEmail`'s top-level `attachments` carry `description`, a one-line
  description read from the file where the organization has attachment
  reading on, else null. `testEmailRule` results carry
  `attachment_descriptions`, aligned with `attachment_names`. Rule
  questions read text from PDF and image attachments where attachment
  reading is active for the organization.
- `getEmailRuleSettings` and `updateEmailRuleSettings` (`/email-rule-settings`)
  read and set `rules_read_attachments`, with `available`, `hipaa_mode` and
  `active`. For a person only, not an API key or an agent key. Changing it
  needs `email_rule_settings:manage` and, with an OAuth token, a step-up
  token of purpose `org_settings.write`; turning it on is refused with
  `409` under HIPAA mode (`hipaa_mode`) or while email rules are not
  available (`not_available`).
- A rule share's `activity` carries `checked`: false when whether the share
  is working could not be read just now, with `last_decided_at` null.
- Webhooks take custom request `headers` on `createEndpoint` and
  `updateEndpoint` (name and value, values stored encrypted and never
  returned), and endpoint reads list them with each value redacted. On
  `updateEndpoint` the list replaces the stored one and `[]` removes them;
  a non-empty list needs `url` in the same request (`details.reason`
  `headers_need_url`), and a webhook that has headers changes its URL only
  with headers in the same request.
- A created webhook, and an updated one given a new URL, is sent a test
  request, and the answer's `warnings` can carry `url_requires_login` and
  `url_redirects` (with the `status` the URL answered), `url_unreachable`
  and `url_not_checked`. The webhook is saved whatever it answered.
- `listDeliveries` and `getDelivery` carry `rules`, the rules the
  attempt's payload named that you can read, by id and name.
- The `request_id` of `createProject`, `inviteOrganizationMember` and
  `inviteProjectMember` is marked `x-primitive-retry-id` in the spec.

CLI, breaking:

- A generated command missing a required request body field, after its
  flags, JSON and defaults are merged, stops before authentication or any
  request with exit 2 and error code `usage_error`, whose
  `error.details.missing` lists each field as `{ field, flag, json_path }`
  (`flag` is null for a field only JSON can give).
- An `--event-types` value that cannot be used, on `endpoints create` or
  `update`, is refused before authentication.

CLI, added:

- `test-email-rule` prints, without `--json`, how many emails the tree
  would newly match and stop matching against the rule's current version,
  or against a request's rule as asked, with a few subjects each way, and
  marks the expectations and samples a close call decided. The look-alikes
  report marks close calls and prints the counts by group. The `--json`
  document is unchanged.
- `--expectation-samples-file` and `--add-expectation-samples-file` send
  only `expected`, `label` and `email` of each made-up email;
  `--expect-samples-file` on a test keeps each look-alike's `group`.
- `list-email-rules` takes `--all`, `--author`, `--mailbox`, `--kind` and
  `--state`, prints a table of the rules (with RECEIVERS for `--all`), and
  says what to do when `--all` or an address filter is refused. The
  decision listings print a table with when each was decided, the outcome,
  the email, its mailbox, sender and subject. The tables go to stderr;
  stdout keeps the JSON.
- `endpoints create` and `endpoints update` take a repeatable `--header
  'Name: value'`, and `update` takes `--clear-headers`. An update that sets
  headers without `--url` reads the webhook's URL and sends it, keeping a
  webhook that is turned off turned off. No message repeats a header
  value. Both commands print the answer's warnings, such as a URL that
  appears to require a login.
- An unknown command suggests up to three nearby commands or topic help,
  in `error.details.suggestions` under `--json`, and still exits 2 with
  `command_not_found`.
- Short and full help group a command's flags as required inputs, command
  options and common flags, in that order, and name required fields that
  only JSON can give.
- For a request field marked `x-primitive-retry-id`, a generated command
  creates a retry ID when the flag is left out and reuses it through
  approval. Human output prints it before the request; under `--json`,
  `cli_retry_ids` lists it as `{ field, flag, json_path, value, source }`
  on success or failure, so the same request can be retried with it. `projects create-project`, `organizations invite-organization-member`
  and `projects invite-project-member` do so for `--request-id`.

What `3.0.0-preview.19` (`3.0.0rc19`) changes from `3.0.0-preview.18`:

CLI, breaking:

- On a credential that reads mail on more than one domain, every mail
  listing or search stops with exit 2 and error code `focus_required` until
  a focus is chosen. The error names the domains and both choices:
  `primitive focus set <domain...>` or `primitive focus set --all`. The
  choice is saved, so it is made once; `primitive focus clear` brings the
  question back. For one command, `--domain <name>` or `--all-domains`
  answers it instead. A credential that reads one domain never sees this.
  The commands are `emails list`, `emails latest`, `emails search`,
  `search`, `emails watch`, `inbox next`, `sent list` and
  `semantic-search`.
- The generated `emails list-emails` and `emails search-emails` commands
  take `--domain-ids` (comma-separated) in place of `--domain-id`,
  following the API.
- `search --domain` and `emails watch --domain` take a domain name as the
  focus for that command, sent as its domain id, instead of adding a
  `domain:` filter to the query.

CLI, added:

- `search --domain-id`, `emails watch --domain-id` and `emails wait
  --domain-id` send `domain_ids`; they behave as before.
- The generated `sending list-sent-emails` command takes `--domain-ids`,
  and the generated list and search commands take `--domain` and
  `--all-domains` for the focus. `search --domain` now works in semantic
  mode too.
- `primitive focus set <domain...>`, `primitive focus set --all`,
  `primitive focus` (show the focus and the domains) and `primitive focus
  clear`. Names are checked against the verified domains the credential
  reads and saved with their ids; a name it does not read fails with
  `focus_domain_unknown`, and a saved domain it no longer reads fails with
  `focus_domain_missing`, naming it.
- The focus is saved per profile and per organization: for the member
  login in `focus.json` in the CLI config directory, for a connected agent
  in `focus.json` in its own profile directory. It is never written to a
  credential file.
- Overrides, strongest first: `--domain <name>` or `--all-domains` on one
  command, then `PRIMITIVE_FOCUS_DOMAINS=<name,...>` (or `all`) for a
  session, then the saved focus. A command given its own scope
  (`--domain-ids`, `--domain-id`, `--recipient`, `--to`, `--from` on
  `sent list`, `--thread-id`,
  `--reply-to-sent-email-id`, or a `domain:` or `to:` search filter) ignores
  the session and saved focus.
- Every focused command prints one stderr line naming the focus, where it
  came from and how to widen it. Under `--json` that line is left out and
  the document carries `meta.focus` (`domains`, `all`, `source`, `applied`,
  `widen`, and `received_only` on a focused semantic search); `emails watch
  --jsonl` keeps the line. An empty focused result says how much matching
  mail is on the other domains (a semantic search points at
  `--all-domains` instead); `emails watch` says it once per run.
- `sent list` filters by the sending domain. `semantic-search` with a focus
  searches received mail only; with sent mail in `--corpus` it covers every
  domain and reports the focus as not applied, and `--domain` beside it is
  refused.
- The focus never filters reads by id, notifications (`listen`, `wait`,
  `emails wait`, `agent check-mail`, `chat`) or the CLI's own reply
  bookkeeping.
- `create-email-rule-request --help` and `accept-email-rule-request --help`
  say that `--scope-address` and `--scope-domain`, as well as
  `--evaluation-scope`, add a scope to a compiled rule, so the saved
  compile `rule` those two take must come from a compile without any of
  them.

API and SDKs, breaking:

- `listEmails` and `searchEmails` no longer take `domain_id`. They take
  `domain_ids`: domain ids, comma-separated or with the key repeated, at
  most 50. In Python the `domain_id` argument is gone and `domain_ids` is a
  `str`; in Go `DomainID` is gone and `DomainIds` is an `OptString`.
- `testEmailRule`'s `skipped_reason` can be `not_relay_domain`: email rules
  decide only mail received on the organization's mail relay domains. The
  recent window holds only that mail, and an email named by id that was
  received elsewhere is reported as skipped. In Python and Go the
  `skipped_reason` enum gains the value.

API and SDKs, added:

- `listSentEmails` takes `domain_ids` (sends from an address at one of
  them) and answers `meta.domain_ids`. `searchEmails` with `direction`
  `outbound` or `any` also matches sent mail from an address at one of
  them.
- The `semanticSearch` body takes `domain_ids` (at most 50, received mail
  only): it is refused with corpus `outbound`, and the default corpus
  becomes `inbound`.
- A filter by `domain_ids` only narrows: an id the caller cannot read, or
  of another organization, matches no mail and is not reported. The list,
  search, sent and semantic search answers echo the ids given, deduped and
  lowercased, in `meta.domain_ids`.
- `listEmails` declares `meta.total_capped` and `meta.total_unavailable`,
  as the API already sends them.
- Email rules: `email_rule_author_unresolvable` can carry
  `details.reason` `no_relay_mailbox` (nothing on the mail relay domains to
  read) on `testEmailRule`, `testEmailRuleOnSample`, `createEmailRule` and
  `acceptEmailRuleRequest`. On `createEmailRule`,
  `email_rule_scope_not_readable` can carry `details.reason`
  `not_relay_domain` when the scope names an address or domain off the mail
  relay domains. The `own_mailboxes` scope and the scope
  options list cover only the mail relay domains, and a request target's
  `missing_permission` is null with `can_accept` false when that member
  has no own mailbox there.

What `3.0.0-preview.18` (`3.0.0rc18`) changes from `3.0.0-preview.17`:

CLI, breaking:

- `--json` on every generated command prints the API's response body
  (`data`, and `meta` with `meta.cursor` where the route sends it) plus the
  CLI's own `summary`, `warnings`, `error` and `exit_code`. Read a list as
  `.data[]` and an object's fields as `.data.<field>`. `--envelope` is
  removed, from generated commands and from `emails attachment-members`,
  `memories search`, `search` and `sent get`. Without `--json`, stdout is
  still the data payload. `search` always prints its total and next page
  below the table.
- An error the CLI raises carries a `code` under `--json`: `usage_error`
  (exit 2) for a refusal before anything was sent, such as a bad flag or a
  file it cannot read or parse (`--body-file`, `--raw-body` and the rules
  file flags included), and `cli_error` otherwise. The CLI's own notes go to
  `cli_warnings` when the document already has `warnings`.
- `test-email-rule` exits 1 when an expectation failed or is undecided and
  the answer does not say testing again can decide it, 3 when every
  undecided one can be decided later, and 0 otherwise, with `error.code`
  `expectations_failed` or `expectations_undecided`. It reads each undecided
  expectation's `reason` and `retryable` from the answer.
  `expectations_unresolvable` is gone.
- `create-email-rule` and `update-email-rule` lose `--fail-on-expectations`;
  every refused API write exits 1 and prints the API's error, with no hint
  of the CLI's own. Rule writes lose `--explanation` and `--if-version`.
- A compile answer's `rule` is the body create and update take, and, when
  compiled without a scope (`--evaluation-scope`, `--scope-address` or
  `--scope-domain`), the body rule request create and accept take: save it
  with `compile-email-rule ... --json | jq .data.rule`.
- `delete-email-rule` deletes without asking and no longer takes `--yes`.
- `generate-look-alikes` no longer takes `--samples-file`; the answer saved
  with `--json` is a samples file. Every report names a made-up email
  `sample N`, its place from 1 among those judged.
- `--same-emails-as` no longer compares the two answers.
- The rules commands no longer check inputs the API checks (email id shapes,
  sample fields and counts, scope address and domain forms, a domain beside
  a rule on `keys create`). `--scope-address` and `--scope-domain` send
  `evaluation_scope: selected` when no scope is given.
- `sent list` (and `sending list-sent-emails`) lists your own sends:
  it sends `mine=true` unless `--all-senders` or `--mine` is given. Without
  `--json` a line says whose sends these are and a table follows on stderr,
  sender first.
- `endpoints create` for a webhook sends `rules.event_types:
  ["email.received"]` when no event types are named. `--event-types` sends
  `family.*` and every name as given, for the API to expand or refuse; on
  update it replaces the stored list. Adding rule events to an existing
  webhook takes `--url` again.
- `emails facts` reads the email's own `understanding.facts`.
- The per-command rules reports are replaced by one printer of the server's
  scope warnings, warnings and notes on a single answer. The every-page note
  on the rule request, share and objection lists, doctor's "Asked of you"
  row, the observe footer and the pending rows of `activity concerning`, and
  the whole-mailbox warning of `keys` are removed.

CLI, added:

- `primitive skills install [name]` installs the skills bundled in the
  package for a runtime (`--runtime claude|codex`, `--project`, `--json`).
- `keys list` and `keys get` show the key a key was rotated to and from.
- doctor shows a `SKIP` domains row for a credential that may not list
  domains.
- Server text in the rules tables, reports and key notes is printed without
  terminal control sequences or reordering marks.

API and SDKs:

- `compileEmailRule` answers with `rule` (`english`, `kind`, `tree` and, when
  given, the scope), `explanation`, `assumptions` and `warnings`; `tree`,
  `kind`, `compiled_by`, the breadth fields and `scope_warnings` go. Rule
  writes and requests no longer take `explanation`, `assumptions`,
  `warnings` or `compiled_by`, and `updateEmailRule` no longer takes
  `if_version` or `if_expectations_pass`: one expectations gate judges a
  write that leaves a rule active on a new version or turns it active. A
  judgment that finishes too late answers `503` `judged_too_late`. The error
  codes `expectations_unreadable` and `no_expectations` are removed.
- On a `testEmailRule` answer, each undecided entry in
  `expectations.results` and `expectations.samples` carries `reason` and
  `retryable`. A tested rule carries `kind` and `warnings`.
- A question answer's `confidence` is required and `probability` is
  removed. `testEmailRuleOnSample` no longer takes `with_protection`.
  `listEmailRuleResults` drops `classification`, `email` and
  `not_run_reason`, and email reads drop `rule_deliveries`.
- Rule, version, request, share and covering answers drop their prose notes
  (`notice`, `share_notice`, `do_not_share_note`, `objection_notice`,
  `restored_from`) and `server_explanation`, `server_notes`,
  `decided_by_user_id` and `proposed_via`; a rule's `note` and
  `protection_note` remain, and a rule request carries `share_terms`. Accepting a rule request answers with the rule
  and its share. A share list with `box=all` is for owners and admins.
  Fields every answer sends are required in the types.
- An objection reads `closed` once nobody can answer it.
- `listActivityObjects` with `relation=concerning` no longer lists `pending`
  rows or sends `as_of`, `pending_complete` or `rule_now`.
- `listSentEmails` takes `mine` (`"true"` or `"false"`); `meta.mine` says
  whether it was applied and to which addresses.
- An http webhook is created with `rules.event_types`; the API refuses one
  without it. `family.*` names expand on write to every event in the
  family, and unknown names are refused. Rule event types can be added to a
  webhook its owner made when the update restates `url`.
- The webhook catalogs gain `email_rule_objection.amended`, the
  `email_rule_coverage.*` events (`started`, `new_version`, `stopped`) and
  the `credential.*` events. The Node SDK adds `EmailRuleCoverageEvent` and
  `isEmailRuleCoverageEvent`, and an objection event's status can be
  `amended`, with `amended_version` and `amend_note`.

Also changed from `3.0.0-preview.17`:

- Not noted in an earlier preview: a send with `unsubscribe` (`sendEmail`
  and each `sendMailBatch` message) must have exactly one recipient across
  `to`, `cc` and `bcc` (an address given twice counts twice); a send to
  more is refused with a `validation_error`. A `replyToEmail` with
  `unsubscribe` goes to the one address it answers, and one with
  `reply_all` that adds a cc is refused the same way.
- An email notification kind's `class` can be `org_only`: the organization
  alone turns it on (for every owner and admin) or off.
  `updateEmailNotificationSettings` takes only `off` or `required` for it
  and answers another mode with `409` `conflict`, `details.reason`
  `mode_not_allowed`. `updateEmailNotificationPreferences` refuses it with
  `details.reason` `not_member_choice` and `details.org_mode` `org_only`,
  and `getEmailNotificationPreferences` leaves it out.
- New error code: `mail_import_storage_not_ready`.
- `imported` describes an uploaded EML file as `from` `unknown`, `method`
  `api_upload` and `verification` `unverified`, beside the Google Workspace
  import. It is declared, required and nullable, on thread messages, on
  sent email reads and on outbound messages in the change feed. In
  Python, `imported` is a required argument of `ThreadMessage` (after
  `id`), `SentEmailSummary` and `SentEmailDetail` (after
  `interaction_kind`).
- `listEmails` takes `count` (`"true"` or `"false"`): with `"false"`, a
  history page runs no total count, `meta.total` is absent and
  `meta.has_more` says whether another page follows. `meta.total` is
  therefore optional on `listEmails`: in Python `EmailListMeta.total` is
  `int | Unset` and no longer a required argument, in Go `Total` is
  `OptInt`, and in TypeScript `total` is optional.
- An agent's `presence` may carry `basis`, `probe` or `organic`.
- `listEmailRulesCoveringMe` items require `english` and `explanation`
  (nullable). In Python they are required arguments of
  `EmailRuleCoveringMe`, after `created_at`; in Go they are `NilString`
  (were `OptNilString`); in TypeScript they are `string | null`.
- `listActivityObjects` items no longer declare `receivers_change`. The
  Python models and Go types for it are removed.
- The `downloadDomainZoneFile` description says when SPF is left out of the
  zone file.

What `3.0.0-preview.17` (`3.0.0rc17`) changes from `3.0.0-preview.16`:

- `amendEmailRuleObjection` (`POST /email-rule-objections/{id}/amend`)
  lets a rule's author answer a pending objection as amended, with an
  optional `note` the objector sees, once they have saved a newer version
  of the rule. Until then it answers `409` `conflict` with
  `details.reason` `no_new_version`, `details.objected_version` and
  `details.current_version`. An objection's `status` can be `amended`, and
  it carries `rule.objected_version`, `rule.amended_version` and
  `amend_note`, which the spec requires. In Python, `amend_note` comes
  before `created_at` in the arguments of the objection models, and
  `EmailRuleObjectionRule` takes `objected_version` and `amended_version`,
  so code that builds them positionally needs updating. The objection
  descriptions say an email to the rule's author quotes the objector's
  message, and that withdrawing does not take the message out of an email
  already sent or being sent. In the CLI it is `email-rule-oversight
  amend-email-rule-objection --id <objection-id> --note <text>`.
- New error code: `key_revoked`, a `401` for a full API key that was
  revoked, named in the Go and Python clients. The CLI prints its message
  without the sign-in hint, `listen` stops and says to connect the agent
  again, and the default From lookup of `send` and `chat` treats it as a
  refused credential.
- A rule question's answer in `testEmailRule` (its results and sample
  judgments), `testEmailRuleOnSample`, `generateLookAlikes` and
  `listEmailRuleResults` carries `confidence`, how sure the answer is from
  0 to 1 (the chance of the answer given, as webhook payloads carry it),
  null when unanswered. `probability`, the chance the answer is yes, is
  deprecated in its favour. In Python those answer models take
  `confidence` before `error_class`, so a fourth positional argument now
  lands in `confidence`: pass `error_class` by keyword. Without `--json`,
  `email-rules test-email-rule` shows each answer at its `confidence`, so
  a no reads "no at 0.80" rather than "no at 0.20", working it out from
  `probability` when an answer has none.
- A rule share (`getEmailRuleShare`, `listEmailRuleShares`,
  `listGivenEmailRuleShares` and the `share` of `acceptEmailRuleRequest`)
  declares `activity` for the member it is shared with: `rule_active`,
  `last_decided_at`, `shared_emails` (counted up to 10,000, with
  `shared_emails_more` past that) and `last_shared_at`. Without `--json`,
  `email-rules get-email-rule-share` and `list-email-rule-shares` print a
  line for each share that carries it, saying whether it is working: the
  hour in which its rule last looked at an email in the sharing member's
  mailboxes, how many emails it has shared with you and when it last did,
  and when the rule is not active or, from `delivery_paused`, new email is
  not being shared right now.
- `listActivityObjects` declares the `stopped` coverage notice and its
  `stop_reason` (`deleted`, `turned_off` or `no_longer_covers`), which the
  CLI already read. Its descriptions no longer list the
  `receivers_changed` notice, which the API no longer sends;
  `receivers_change` stays declared, and optional. `primitive activity
  concerning` and `primitive doctor` no longer describe or count
  `receivers_changed` notices, though one written before still shows its
  totals in the CHANGE column: the help says a change in who receives a
  rule's matches is not listed, and that `email-rule-oversight
  get-email-rule-covering-me <rule-id>` shows who receives them now.
- The `rules` of a key's grant (`createKey`, `updateKey`,
  `decideSuspension`) say which addresses are refused beside them (a
  domain, a retired address, or the address of a member other than the
  key's holder), with `400` `validation_error` and `details.reason`
  `rules_beside_domain` or `rules_beside_personal_mailbox`, and that a rule
  shared with you goes there by its share's id, from your dashboard session
  only. The `last_error` of `listDeliveries` and `getDelivery` says a
  webhook's answer is quoted as plain text, at most 300 characters (older
  attempts can quote more).
- `confidence`, `activity` and `stop_reason` are optional, so the clients
  read an answer from a server that does not send them yet.
- `primitive doctor` prints one thing. Without `--json` it prints the
  readable checklist, now on stdout, and nothing else. With `--json` it
  prints only the JSON summary (`ok`, `warnings` and `checks`, and an
  `error` naming the failed checks when one failed), with nothing on
  stderr. Before, every run printed the checklist on stderr and the JSON
  on stdout.
- `send` and `reply` with `--json`, stopped before the request is made,
  lead `outcome_message` with the reason (`Message not sent: <reason>
  Nothing went out; ...`, or `Reply not sent: ...`), as for a send the API
  refused. When `send` or `chat` has no From to default to, its error
  carries a code: `no_send_address` when the credential lists nothing it
  can send from, and `no_default_from` when `--from` is needed to choose.
- An unknown command suggests a command of the same name in another group:
  `primitive email-rules list-email-rule-objections` asks `Did you mean
  "primitive email-rule-oversight list-email-rule-objections"?` before
  pointing to `--help`. Only the word typed where a subcommand was
  expected is looked up (at the top level, the first two words), never a
  value after it; hidden commands are not suggested, and more than three
  matches give no suggestion.
- A generated text flag whose request field has a maximum length, and
  whose description does not already give a limit, says "At most N
  characters." in its help, such as `--name`, `--english` and
  `--explanation` on the rule request commands. A field held to a pattern
  or format is left alone.
- `email-rules test-email-rule --same-emails-as <file>` ends its report
  with what changed against that earlier answer, over the emails both
  tested: the emails whose outcome changed; for each top-level condition,
  how many of the emails both answers decided on their conditions it held
  on, earlier and now, with how many it lost and gained; and how many
  emails matched before and still match, naming up to five by subject.
  With `--json`, the document gains a `comparison` key beside the answer's
  own.
- `keys create` refuses `--domain` beside `--rule`, and `keys update`
  refuses a rule added to a key that lists a domain, both with exit code 2
  before any change is sent. When a key reads an address in full beside its
  rules, the warning now comes first: a `Warning:` line on stderr before
  the result, or with `--json` the document's first field,
  `whole_mailbox_warning`, and the first entry of its `warnings` (reason
  `whole_mailbox`). The help of `keys create` and `keys update` says which
  addresses the API refuses beside a rule (another member's mailbox, a
  former member's included, or a retired address), judged by the key's
  holder, and that the holder's own address may be listed; that the API
  also refuses a permission added to a key that lists rules beside such an
  address or a domain; that a rule shared with you goes on a key by the
  share's id, from your own dashboard session only; and that a change to
  the permissions or rules of a key that lists a share made with you is
  made from the dashboard, unless it takes the share off.
- The objection tips follow the amended answer:
  `create-email-rule-objection` lists it among the author's answers,
  `decline-email-rule-objection` no longer tells an author who changed the
  rule to decline with a reason but points to `email-rules
  update-email-rule` and then `amend-email-rule-objection`, and
  `amend-email-rule-objection` says to save the new version first.

### Breaking changes

#### Versions and module path

- The Node SDK, the Python SDK, the Go module and the CLI are all 3.0.0. The
  CLI moves from 1.75.0.
- The Go module path is `github.com/primitivedotdev/sdks/sdk-go/v3`. Update
  imports from `.../sdk-go/v2` and `.../sdk-go/v2/api`.
- `primitive functions init` scaffolds projects on `^3.0.0-preview.21` of both
  `@primitivedotdev/sdk` and `primitive`.

#### Removed code

These no longer exist, so code that uses them stops compiling or running:

- Node: the `@primitivedotdev/sdk/x402` subpath and the `X402*` exports.
- Python: the `primitive.x402` package.
- Go: `X402Client`, the `X402*` types and the payment helpers such as
  `NewPrivateKeySigner`.
- CLI: `primitive payments`, `primitive registries` and the
  `PRIMITIVE_X402_PRIVATE_KEY` environment variable.
- Generated clients: the payment and agent registry operations, and their
  webhook event types and guards.

#### Removed error codes and fields

- The `error.code` enum no longer lists those features' codes or a retired
  signup code that `signup_failed` replaced. Their generated enum members are
  gone, for example the Go `ErrorResponseErrorCodeChallengeExpired` constant.
- `Account` no longer declares its subscription status field, and the
  generated `Account` types drop it.

#### Account permission

- `account:read` is no longer a permission: the Node `PERMISSIONS` list no
  longer has it, and `OPERATION_PERMISSIONS` lists no permission for
  `getAccount`, `getSendPermissions` and `whoami`.

#### Built-in role keys

- `operator` is no longer a built-in role key. The API's `BuiltinRoleKey`
  lists `owner`, `admin` and `member`; Operator is a template role with a key
  of its own. The Node `BUILTIN_ROLE_KEYS` list and `BuiltinRoleKey` type no
  longer have `operator`, and Python's `BuiltinRoleKey.OPERATOR` is gone (a
  value the API adds later still decodes, so `BuiltinRoleKey("operator")`
  does too: check membership against the enum's listed values). Go's
  `RoleOperator` is removed: `BuiltinRoleKeys()` leaves it out and
  `IsBuiltinRoleKey("operator")` is false.

#### Not in the SDKs

- `GET /health` (`getHealth`), an unauthenticated health check for uptime
  monitors, is served but not wrapped by the SDKs or the CLI.

#### Conversation reads

- `Conversation` now requires only `thread_id` and `messages`. `subject`,
  `message_count` and `truncated` are optional because an empty `since` delta
  omits them. In Go, `Conversation.MessageCount` is `OptInt` (was `int`) and
  `Conversation.Truncated` is `OptBool` (was `bool`); a delta without them
  previously failed to decode.

#### Newly required response fields

These fields are now required in the generated types (non-optional in Node,
no longer `UNSET` in Python, plain or `Nil*` fields rather than `Opt*` in Go):

- `EmailSummary`, `EmailSearchResult`, `ChangeInboundMessage`:
  `from_verified`, `from_header_email`, `snippet`.
- `EmailDetail`: `from_verified`, `from_header_email`, `from_name`, `snippet`.
- `SentEmailSummary`, `SentEmailDetail`, `ChangeOutboundMessage`:
  `interaction_hint`, `interaction_kind`, `snippet`.
- `Thread`: `latest_inbound_id`, `latest_outbound_id`.
- `VerifiedDomain`: `dns_health`.
- `PresenceControl`: `status`, `valid_for_ms`.
- The list responses of `listContacts`, `listAgentContacts`,
  `listAgentConnections`, `listDefaultNetworkMembers` and
  `listDefaultNetworkAgents`: `meta`, with `limit` and a nullable `cursor`.
  In Go, `Meta` is the plain meta type rather than an `Opt...` wrapper.
- The email rule lists `listEmailRules`, `listEmailRuleRequests`,
  `listEmailRuleShares`, `listGivenEmailRuleShares`,
  `listEmailRuleShareEmails` and `listEmailRuleDecisions`: `meta`
  (`CursorPageMeta`, with `limit` and a nullable `cursor`).
  `listEmailRuleVersions` carries it too, except when `versions` is given.
- `DeliverySummary`, which `listDeliveries` and `getDelivery` return:
  `latest_attempt`, `next_attempt_at`, `response_status` and
  `response_body`.
- `listEmailRuleShareEmails` items: `shared_at`.
- `DeliverySummary`, `getDelivery`'s result and each of its `attempts`:
  `retry_scheduled`. In Python it comes before `next_attempt_at` in the
  arguments of `DeliverySummary` and the `getDelivery` result.
- `whoami`: `email`, `role_name`.
- `testEndpoint`'s answer (`TestResult`): `reachable`, `delivery`.
- `testEndpointRules`' answer: `delivery`.
- `listEmails`: `data`. In Python it comes before `meta` in the arguments of
  `ListEmailsResponse200`.
- Email rule tests and look-alikes: `close_call` on each judged
  expectation, made-up email and look-alike, `close_calls` in the test's
  expectation counts and the look-alike counts, and each look-alike's
  `group` and the look-alike counts' `by_group`. A write's
  `expectations_check`: `close_calls` and `close_call_samples`.
- `listEmailRuleDecisions` and `listEmailRuleDecisionsOnMyMail` items:
  `recipient`.
- `DeliverySummary` and `getDelivery`'s result: `rules`.
- `getEmail`'s top-level `attachments`: `description`. They are
  `EmailDetailAttachment` in Python and Go; in Go `EmailDetail.Attachments`
  is `[]EmailDetailAttachment`.
- A rule share's `activity`: `checked`.
- A rule share: `rule_name` and `accept_changes`, both nullable.
- A rule request, and the results of `createEmailRuleRequest`,
  `getEmailRuleRequest`, `declineEmailRuleRequest` and
  `withdrawEmailRuleRequest`: `accepted_english`, nullable.

#### Nullable values

- A pulled event's body is null when the API withholds the content from the
  credential, whether the API sends `body: null` or leaves the key out. All
  three SDKs treat both the same way, pinned by
  `test-fixtures/local-event-receiver.json`. Node `LocalEvent.body` is `string | null` and `data` is null
  with it; Python `LocalEvent.body` is `str | None` and `data` is
  `WebhookEvent | None`; Go `LocalEvent.Body` is `*string` and `Decode`
  returns `ErrEventContentWithheld`.
- A send result's client idempotency key and request id are null when a
  replayed send was stored without one: Node `SendResult.clientIdempotencyKey`
  and `requestId` are `string | null`, Python
  `SendResult.client_idempotency_key` and `request_id` are `str | None`, and
  Go `SendResult.ClientIdempotencyKey` and `RequestID` are
  `primitiveapi.NilString`, as are the generated `SendMailResult` fields.
- `getAccount` returns `limits` and `entitlements` as null for a credential
  that does not hold `org:read`, and other account fields as null when the
  credential lacks the permission each one needs.
- An email's parsed content and a conversation message's `text` can be null.
- `testEndpoint`'s `body` (`TestResult.body`, the receiver's answer) is null
  for a caller without organization-wide `mail.raw:read`, since a receiver
  can echo a raw download link: Node `string | null`, Python `str | None`,
  Go `NilString`.
- An enum field that can be null lists null among its values in the published
  spec, so a 3.1 validator accepts it, and the Node types include `| null`
  (for example `Endpoint.owner_key_status`). In Python such a field is typed
  as the union of generated enum classes used for other nullable enums, for
  example `EndpointOwnerKeyStatusType1 | EndpointOwnerKeyStatusType2Type1 |
  EndpointOwnerKeyStatusType3Type1 | None`.

#### Domain verification

`DomainVerifyResult` has one shape. A failed DNS check is answered with
`400 dns_verification_failed` and the expected records in
`error.details.records`, never a success body with `verified: false`. The Go
`DomainVerifyResult0` and `DomainVerifyResult1` variants and the Python
`DomainVerifyResultType0` and `DomainVerifyResultType1` models are gone.

#### Go error response types

63 generated error response types that had the type `ErrorResponse`, mostly
the 401 `...Unauthorized` types plus some 500, 502 and 503 types, are now
`ErrorResponseHeaders`. It holds the `ErrorResponse` in `Response` next to
the `Retry-After` and `ratelimit-*` headers. Code that converted one of these
types to `ErrorResponse` reads `.Response` instead. The high-level `Client`
maps them to `APIError`, with `RetryAfter` set when the header is present.

#### Python model names

Nullable object components now carry their nullability on each reference, so
their models have the component's own name:

- `PresenceControlType0` is `PresenceControl`, and
  `PresenceControlType0Status` is `PresenceControlStatus`.
- `FunctionTestRunSendType0` is `FunctionTestRunSend`.
- `FunctionTestRunInboundEmailType0` is `FunctionTestRunInboundEmail`.
- `FunctionTestRunDeliveryEndpointType0` is `FunctionTestRunDeliveryEndpoint`.

Generated models take their optional fields in the order the served document
declares them, so a field the API adds can land between existing ones: pass
optional fields by keyword, as the README examples do.

Other generated model names follow the served document's schema names and
shapes. Among them: `MemoryScopeType0` and `MemoryScopeType1` are
`MemoryScope`; `CallerIdentity` is `WhoamiResponse200Data`;
`OrganizationLeft` is `LeaveOrganizationResult`; `InboxStatusEndpointSummary`,
`InboxStatusFunctionSummary` and `InboxStatusRecentEmailSummary` are
`InboxStatusEndpoints`, `InboxStatusFunctions` and `InboxStatusRecentEmails`.

#### Renamed Email Rules types in Python and Go

The API document now defines the Email Rules objects once, as named
components, and references them where they recur. The generated Python and
Go types for those objects are named after the component instead of after
each operation and field. Shapes are unchanged apart from the new fields
listed under Additions, and each new name replaces every old name listed with
it. Request bodies' trees use `EmailRuleTreeInput` (its `questions` may be left
out) and answers' trees use `EmailRuleTree`. In Go, `createEmailRule` and
`updateEmailRule` answer with `EmailRuleWritten`, `getEmailRule` with
`EmailRuleRead`, the rule request reads with `EmailRuleRequest` and
`getEmailRuleShare` with `EmailRuleShare`, and the `Opt`, `OptNil` and `Nil`
wrappers follow their types. Python keeps each operation's top-level result
class under its old name, and also exports the `EmailRuleRead` and
`EmailRuleWritten` models and their enums, which those result classes mirror.

Other changes to existing email rule types:

- Rule writes and rule requests do not take `explanation`, `assumptions`,
  `warnings` or `compiled_by`: the server writes Primitive's reading itself.
- Go: `ListEmailRuleVersionsParams.Versions` is an `OptString`.

Python (`primitive.api.models`):

- `EmailRule` replaces `ListEmailRulesResultItem`.
- `EmailRuleEvaluationScope` replaces `ListEmailRulesResultItemEvaluationScope`.
- `EmailRuleKind` replaces `ListEmailRulesResultItemKind`.
- `EmailRuleRequest` replaces `AcceptEmailRuleRequestResultRequest`, `ListEmailRuleRequestsResultItem`.
- `EmailRuleRequestProposer` replaces `AcceptEmailRuleRequestResultRequestProposer`, `CreateEmailRuleRequestResultProposer`, `DeclineEmailRuleRequestResultProposer`, `GetEmailRuleRequestResultProposer`, `ListEmailRuleRequestsResultItemProposer`, `WithdrawEmailRuleRequestResultProposer`.
- `EmailRuleRequestStatus` replaces `AcceptEmailRuleRequestResultRequestStatus`, `ListEmailRuleRequestsResultItemStatus`.
- `EmailRuleRequestTarget` replaces `AcceptEmailRuleRequestResultRequestTarget`, `CreateEmailRuleRequestResultTarget`, `DeclineEmailRuleRequestResultTarget`, `GetEmailRuleRequestResultTarget`, `ListEmailRuleRequestsResultItemTarget`, `WithdrawEmailRuleRequestResultTarget`.
- `EmailRuleScopeNames` replaces `AcceptEmailRuleRequestResultRuleScopeSelectionType0`, `CreateEmailRuleResultScopeSelectionType0`, `GetEmailRuleResultScopeSelectionType0`, `GetEmailRuleScopeResultNoLongerReadable`, `GetEmailRuleScopeResultScopeSelectionType0`, `ListEmailRulesResultItemScopeSelectionType0`, `UpdateEmailRuleResultScopeSelectionType0`.
- `EmailRuleScopeSelection` replaces `CreateEmailRuleRequestScopeSelection`, `TestEmailRuleOnSampleRequestScopeSelection`, `TestEmailRuleRequestScopeSelection`, `UpdateEmailRuleRequestScopeSelection`.
- `EmailRuleShare` replaces `AcceptEmailRuleRequestResultShare`, `ListEmailRuleSharesResultItem`, `ListGivenEmailRuleSharesResultItem`.
- `EmailRuleShareBeneficiary` replaces `AcceptEmailRuleRequestResultShareBeneficiary`, `GetEmailRuleShareResultBeneficiary`, `ListEmailRuleSharesResultItemBeneficiary`, `ListGivenEmailRuleSharesResultItemBeneficiary`.
- `EmailRuleShareEndReasonType1` replaces `AcceptEmailRuleRequestResultShareEndReasonType1`, `ListEmailRuleSharesResultItemEndReasonType1`, `ListGivenEmailRuleSharesResultItemEndReasonType1`.
- `EmailRuleShareEndReasonType2Type1` replaces `AcceptEmailRuleRequestResultShareEndReasonType2Type1`, `ListEmailRuleSharesResultItemEndReasonType2Type1`, `ListGivenEmailRuleSharesResultItemEndReasonType2Type1`.
- `EmailRuleShareEndReasonType3Type1` replaces `AcceptEmailRuleRequestResultShareEndReasonType3Type1`, `ListEmailRuleSharesResultItemEndReasonType3Type1`, `ListGivenEmailRuleSharesResultItemEndReasonType3Type1`.
- `EmailRuleShareGranter` replaces `AcceptEmailRuleRequestResultShareGranter`, `GetEmailRuleShareResultGranter`, `ListEmailRuleSharesResultItemGranter`, `ListGivenEmailRuleSharesResultItemGranter`.
- `EmailRuleShareRuleType0` replaces `AcceptEmailRuleRequestResultShareRuleType0`, `ListEmailRuleSharesResultItemRuleType0`, `ListGivenEmailRuleSharesResultItemRuleType0`.
- `EmailRuleShareRuleType0State` replaces `AcceptEmailRuleRequestResultShareRuleType0State`, `ListEmailRuleSharesResultItemRuleType0State`, `ListGivenEmailRuleSharesResultItemRuleType0State`.
- `EmailRuleState` replaces `ListEmailRulesResultItemState`.
- `EmailRuleTree` replaces `AcceptEmailRuleRequestResultRequestTree`, `AcceptEmailRuleRequestResultRuleCurrentType0Tree`, `CompileEmailRuleResultTree`, `CreateEmailRuleRequestResultTree`, `CreateEmailRuleResultCurrentType0Tree`, `DeclineEmailRuleRequestResultTree`, `GetEmailRuleRequestResultTree`, `GetEmailRuleResultCurrentType0Tree`, `ListEmailRuleRequestsResultItemTree`, `ListEmailRuleResultsResultRulesItemDecisionType0TreeType0`, `ListEmailRuleVersionsResultItemTree`, `UpdateEmailRuleResultCurrentType0Tree`, `WithdrawEmailRuleRequestResultTree`.
- `EmailRuleTreeInput` replaces `AcceptEmailRuleRequestRequestTree`, `CreateEmailRuleRequestRequestTree`, `CreateEmailRuleRequestTree`, `TestEmailRuleOnSampleRequestTree`, `TestEmailRuleRequestTree`, `UpdateEmailRuleRequestTree`.
- `EmailRuleTreeInputVersion` replaces `AcceptEmailRuleRequestRequestTreeVersion`, `CreateEmailRuleRequestRequestTreeVersion`, `CreateEmailRuleRequestTreeVersion`, `TestEmailRuleOnSampleRequestTreeVersion`, `TestEmailRuleRequestTreeVersion`, `UpdateEmailRuleRequestTreeVersion`.
- `EmailRuleTreeInputWhen` replaces `AcceptEmailRuleRequestRequestTreeWhen`, `CreateEmailRuleRequestRequestTreeWhen`, `CreateEmailRuleRequestTreeWhen`, `TestEmailRuleOnSampleRequestTreeWhen`, `TestEmailRuleRequestTreeWhen`, `UpdateEmailRuleRequestTreeWhen`.
- `EmailRuleTreeVersion` replaces `AcceptEmailRuleRequestResultRequestTreeVersion`, `AcceptEmailRuleRequestResultRuleCurrentType0TreeVersion`, `CompileEmailRuleResultTreeVersion`, `CreateEmailRuleRequestResultTreeVersion`, `CreateEmailRuleResultCurrentType0TreeVersion`, `DeclineEmailRuleRequestResultTreeVersion`, `GetEmailRuleRequestResultTreeVersion`, `GetEmailRuleResultCurrentType0TreeVersion`, `ListEmailRuleRequestsResultItemTreeVersion`, `ListEmailRuleResultsResultRulesItemDecisionType0TreeType0Version`, `ListEmailRuleVersionsResultItemTreeVersion`, `UpdateEmailRuleResultCurrentType0TreeVersion`, `WithdrawEmailRuleRequestResultTreeVersion`.
- `EmailRuleTreeWhen` replaces `AcceptEmailRuleRequestResultRequestTreeWhen`, `AcceptEmailRuleRequestResultRuleCurrentType0TreeWhen`, `CompileEmailRuleResultTreeWhen`, `CreateEmailRuleRequestResultTreeWhen`, `CreateEmailRuleResultCurrentType0TreeWhen`, `DeclineEmailRuleRequestResultTreeWhen`, `GetEmailRuleRequestResultTreeWhen`, `GetEmailRuleResultCurrentType0TreeWhen`, `ListEmailRuleRequestsResultItemTreeWhen`, `ListEmailRuleResultsResultRulesItemDecisionType0TreeType0When`, `ListEmailRuleVersionsResultItemTreeWhen`, `UpdateEmailRuleResultCurrentType0TreeWhen`, `WithdrawEmailRuleRequestResultTreeWhen`.
- `EmailRuleVersion` replaces `AcceptEmailRuleRequestResultRuleCurrentType0`, `CreateEmailRuleResultCurrentType0`, `GetEmailRuleResultCurrentType0`, `ListEmailRuleVersionsResultItem`, `UpdateEmailRuleResultCurrentType0`.
- `EmailRuleVersionSql` replaces `AcceptEmailRuleRequestResultRuleCurrentType0Sql`, `CreateEmailRuleResultCurrentType0Sql`, `GetEmailRuleResultCurrentType0Sql`, `ListEmailRuleVersionsResultItemSql`, `UpdateEmailRuleResultCurrentType0Sql`.
- `EmailRuleWithVersion` replaces `AcceptEmailRuleRequestResultRule`.
- `EmailRuleWithVersionEvaluationScope` replaces `AcceptEmailRuleRequestResultRuleEvaluationScope`.
- `EmailRuleWithVersionKind` replaces `AcceptEmailRuleRequestResultRuleKind`.
- `EmailRuleWithVersionState` replaces `AcceptEmailRuleRequestResultRuleState`.

Go (package `api`):

- `EmailRule` replaces `ListEmailRulesResultItem`.
- `EmailRuleEvaluationScope` replaces `ListEmailRulesResultItemEvaluationScope`.
- `EmailRuleKind` replaces `ListEmailRulesResultItemKind`.
- `EmailRuleRead` replaces `GetEmailRuleResult`.
- `EmailRuleReadEvaluationScope` replaces `GetEmailRuleResultEvaluationScope`.
- `EmailRuleReadKind` replaces `GetEmailRuleResultKind`.
- `EmailRuleReadState` replaces `GetEmailRuleResultState`.
- `EmailRuleRequest` replaces `AcceptEmailRuleRequestResultRequest`, `DeclineEmailRuleRequestResult`, `GetEmailRuleRequestResult`, `ListEmailRuleRequestsResultItem`, `WithdrawEmailRuleRequestResult`.
- `EmailRuleRequestProposer` replaces `AcceptEmailRuleRequestResultRequestProposer`, `CreateEmailRuleRequestResultProposer`, `DeclineEmailRuleRequestResultProposer`, `GetEmailRuleRequestResultProposer`, `ListEmailRuleRequestsResultItemProposer`, `WithdrawEmailRuleRequestResultProposer`.
- `EmailRuleRequestStatus` replaces `AcceptEmailRuleRequestResultRequestStatus`, `DeclineEmailRuleRequestResultStatus`, `GetEmailRuleRequestResultStatus`, `ListEmailRuleRequestsResultItemStatus`, `WithdrawEmailRuleRequestResultStatus`.
- `EmailRuleRequestTarget` replaces `AcceptEmailRuleRequestResultRequestTarget`, `CreateEmailRuleRequestResultTarget`, `DeclineEmailRuleRequestResultTarget`, `GetEmailRuleRequestResultTarget`, `ListEmailRuleRequestsResultItemTarget`, `WithdrawEmailRuleRequestResultTarget`.
- `EmailRuleScopeNames` replaces `AcceptEmailRuleRequestResultRuleScopeSelection`, `CreateEmailRuleResultScopeSelection`, `GetEmailRuleResultScopeSelection`, `GetEmailRuleScopeResultNoLongerReadable`, `GetEmailRuleScopeResultScopeSelection`, `ListEmailRulesResultItemScopeSelection`, `UpdateEmailRuleResultScopeSelection`.
- `EmailRuleScopeSelection` replaces `CreateEmailRuleRequestScopeSelection`, `TestEmailRuleOnSampleRequestScopeSelection`, `TestEmailRuleRequestScopeSelection`, `UpdateEmailRuleRequestScopeSelection`.
- `EmailRuleShare` replaces `AcceptEmailRuleRequestResultShare`, `GetEmailRuleShareResult`, `ListEmailRuleSharesResultItem`, `ListGivenEmailRuleSharesResultItem`.
- `EmailRuleShareBeneficiary` replaces `AcceptEmailRuleRequestResultShareBeneficiary`, `GetEmailRuleShareResultBeneficiary`, `ListEmailRuleSharesResultItemBeneficiary`, `ListGivenEmailRuleSharesResultItemBeneficiary`.
- `EmailRuleShareEndReason` replaces `AcceptEmailRuleRequestResultShareEndReason`, `GetEmailRuleShareResultEndReason`, `ListEmailRuleSharesResultItemEndReason`, `ListGivenEmailRuleSharesResultItemEndReason`.
- `EmailRuleShareGranter` replaces `AcceptEmailRuleRequestResultShareGranter`, `GetEmailRuleShareResultGranter`, `ListEmailRuleSharesResultItemGranter`, `ListGivenEmailRuleSharesResultItemGranter`.
- `EmailRuleShareRule` replaces `AcceptEmailRuleRequestResultShareRule`, `GetEmailRuleShareResultRule`, `ListEmailRuleSharesResultItemRule`, `ListGivenEmailRuleSharesResultItemRule`.
- `EmailRuleShareRuleState` replaces `AcceptEmailRuleRequestResultShareRuleState`, `GetEmailRuleShareResultRuleState`, `ListEmailRuleSharesResultItemRuleState`, `ListGivenEmailRuleSharesResultItemRuleState`.
- `EmailRuleState` replaces `ListEmailRulesResultItemState`.
- `EmailRuleTree` replaces `AcceptEmailRuleRequestResultRequestTree`, `AcceptEmailRuleRequestResultRuleCurrentTree`, `CompileEmailRuleResultTree`, `CreateEmailRuleRequestResultTree`, `CreateEmailRuleResultCurrentTree`, `DeclineEmailRuleRequestResultTree`, `GetEmailRuleRequestResultTree`, `GetEmailRuleResultCurrentTree`, `ListEmailRuleRequestsResultItemTree`, `ListEmailRuleResultsResultRulesItemDecisionTree`, `ListEmailRuleVersionsResultItemTree`, `UpdateEmailRuleResultCurrentTree`, `WithdrawEmailRuleRequestResultTree`.
- `EmailRuleTreeInput` replaces `AcceptEmailRuleRequestRequestTree`, `CreateEmailRuleRequestRequestTree`, `CreateEmailRuleRequestTree`, `TestEmailRuleOnSampleRequestTree`, `TestEmailRuleRequestTree`, `UpdateEmailRuleRequestTree`.
- `EmailRuleTreeInputVersion` replaces `AcceptEmailRuleRequestRequestTreeVersion`, `CreateEmailRuleRequestRequestTreeVersion`, `CreateEmailRuleRequestTreeVersion`, `TestEmailRuleOnSampleRequestTreeVersion`, `TestEmailRuleRequestTreeVersion`, `UpdateEmailRuleRequestTreeVersion`.
- `EmailRuleTreeInputWhen` replaces `AcceptEmailRuleRequestRequestTreeWhen`, `CreateEmailRuleRequestRequestTreeWhen`, `CreateEmailRuleRequestTreeWhen`, `TestEmailRuleOnSampleRequestTreeWhen`, `TestEmailRuleRequestTreeWhen`, `UpdateEmailRuleRequestTreeWhen`.
- `EmailRuleTreeVersion` replaces `AcceptEmailRuleRequestResultRequestTreeVersion`, `AcceptEmailRuleRequestResultRuleCurrentTreeVersion`, `CompileEmailRuleResultTreeVersion`, `CreateEmailRuleRequestResultTreeVersion`, `CreateEmailRuleResultCurrentTreeVersion`, `DeclineEmailRuleRequestResultTreeVersion`, `GetEmailRuleRequestResultTreeVersion`, `GetEmailRuleResultCurrentTreeVersion`, `ListEmailRuleRequestsResultItemTreeVersion`, `ListEmailRuleResultsResultRulesItemDecisionTreeVersion`, `ListEmailRuleVersionsResultItemTreeVersion`, `UpdateEmailRuleResultCurrentTreeVersion`, `WithdrawEmailRuleRequestResultTreeVersion`.
- `EmailRuleTreeWhen` replaces `AcceptEmailRuleRequestResultRequestTreeWhen`, `AcceptEmailRuleRequestResultRuleCurrentTreeWhen`, `CompileEmailRuleResultTreeWhen`, `CreateEmailRuleRequestResultTreeWhen`, `CreateEmailRuleResultCurrentTreeWhen`, `DeclineEmailRuleRequestResultTreeWhen`, `GetEmailRuleRequestResultTreeWhen`, `GetEmailRuleResultCurrentTreeWhen`, `ListEmailRuleRequestsResultItemTreeWhen`, `ListEmailRuleResultsResultRulesItemDecisionTreeWhen`, `ListEmailRuleVersionsResultItemTreeWhen`, `UpdateEmailRuleResultCurrentTreeWhen`, `WithdrawEmailRuleRequestResultTreeWhen`.
- `EmailRuleVersion` replaces `AcceptEmailRuleRequestResultRuleCurrent`, `CreateEmailRuleResultCurrent`, `GetEmailRuleResultCurrent`, `ListEmailRuleVersionsResultItem`, `UpdateEmailRuleResultCurrent`.
- `EmailRuleVersionSQL` replaces `AcceptEmailRuleRequestResultRuleCurrentSQL`, `CreateEmailRuleResultCurrentSQL`, `GetEmailRuleResultCurrentSQL`, `ListEmailRuleVersionsResultItemSQL`, `UpdateEmailRuleResultCurrentSQL`.
- `EmailRuleWithVersion` replaces `AcceptEmailRuleRequestResultRule`.
- `EmailRuleWithVersionEvaluationScope` replaces `AcceptEmailRuleRequestResultRuleEvaluationScope`.
- `EmailRuleWithVersionKind` replaces `AcceptEmailRuleRequestResultRuleKind`.
- `EmailRuleWithVersionState` replaces `AcceptEmailRuleRequestResultRuleState`.
- `EmailRuleWritten` replaces `CreateEmailRuleResult`, `UpdateEmailRuleResult`.
- `EmailRuleWrittenEvaluationScope` replaces `CreateEmailRuleResultEvaluationScope`, `UpdateEmailRuleResultEvaluationScope`.
- `EmailRuleWrittenKind` replaces `CreateEmailRuleResultKind`, `UpdateEmailRuleResultKind`.
- `EmailRuleWrittenState` replaces `CreateEmailRuleResultState`, `UpdateEmailRuleResultState`.
- `NilEmailRuleScopeNames` replaces `NilGetEmailRuleScopeResultScopeSelection`.
- `NilEmailRuleShareEndReason` replaces `NilAcceptEmailRuleRequestResultShareEndReason`, `NilGetEmailRuleShareResultEndReason`, `NilListEmailRuleSharesResultItemEndReason`, `NilListGivenEmailRuleSharesResultItemEndReason`.
- `NilEmailRuleShareRule` replaces `NilAcceptEmailRuleRequestResultShareRule`, `NilGetEmailRuleShareResultRule`, `NilListEmailRuleSharesResultItemRule`, `NilListGivenEmailRuleSharesResultItemRule`.
- `NilEmailRuleTree` replaces `NilListEmailRuleResultsResultRulesItemDecisionTree`.
- `NilEmailRuleVersion` replaces `NilAcceptEmailRuleRequestResultRuleCurrent`, `NilCreateEmailRuleResultCurrent`, `NilGetEmailRuleResultCurrent`, `NilUpdateEmailRuleResultCurrent`.
- `OptEmailRuleEvaluationScope` replaces `OptListEmailRulesResultItemEvaluationScope`.
- `OptEmailRuleKind` replaces `OptListEmailRulesResultItemKind`.
- `OptEmailRuleReadEvaluationScope` replaces `OptGetEmailRuleResultEvaluationScope`.
- `OptEmailRuleReadKind` replaces `OptGetEmailRuleResultKind`.
- `OptEmailRuleScopeSelection` replaces `OptCreateEmailRuleRequestScopeSelection`, `OptTestEmailRuleOnSampleRequestScopeSelection`, `OptTestEmailRuleRequestScopeSelection`, `OptUpdateEmailRuleRequestScopeSelection`.
- `OptEmailRuleTreeInput` replaces `OptAcceptEmailRuleRequestRequestTree`, `OptTestEmailRuleOnSampleRequestTree`, `OptTestEmailRuleRequestTree`, `OptUpdateEmailRuleRequestTree`.
- `OptEmailRuleVersionSQL` replaces `OptAcceptEmailRuleRequestResultRuleCurrentSQL`, `OptCreateEmailRuleResultCurrentSQL`, `OptGetEmailRuleResultCurrentSQL`, `OptListEmailRuleVersionsResultItemSQL`, `OptUpdateEmailRuleResultCurrentSQL`.
- `OptEmailRuleWithVersionEvaluationScope` replaces `OptAcceptEmailRuleRequestResultRuleEvaluationScope`.
- `OptEmailRuleWithVersionKind` replaces `OptAcceptEmailRuleRequestResultRuleKind`.
- `OptEmailRuleWrittenEvaluationScope` replaces `OptCreateEmailRuleResultEvaluationScope`, `OptUpdateEmailRuleResultEvaluationScope`.
- `OptEmailRuleWrittenKind` replaces `OptCreateEmailRuleResultKind`, `OptUpdateEmailRuleResultKind`.
- `OptNilEmailRuleScopeNames` replaces `OptNilAcceptEmailRuleRequestResultRuleScopeSelection`, `OptNilCreateEmailRuleResultScopeSelection`, `OptNilGetEmailRuleResultScopeSelection`, `OptNilListEmailRulesResultItemScopeSelection`, `OptNilUpdateEmailRuleResultScopeSelection`.

#### Webhook events and validation

- Go `HandleWebhook` and `Receive` return bounces and reports as well as
  received mail. They decide by the event type in the `X-Webhook-Event`
  header, or the body's `event` without it: for an `email.*` type they
  validate the signed body against the email event schema and return it.
  Before, they refused every type but `email.received` with
  `PAYLOAD_UNKNOWN_EVENT`. A handler written for received mail now also gets
  `email.bounced`, `email.tls_report`, `email.dmarc_report` and
  `email.dmarc_failure`: check `email.Raw.Event` from `Receive`, or
  `event.Event` from `HandleWebhook`, and skip the types it does not handle.
  An `email.*` body that does not match the schema is a
  `SCHEMA_VALIDATION_FAILED` error. The Node and Python SDKs validate the body
  against the email event schema whatever the header says.
- Python checks `date-time` values in email and sent_email events, and `uri`
  values in email events, with the patterns the Node validator uses instead of
  jsonschema's optional format packages, so a bad
  `email.content.download.expires_at` or `url` is refused at the schema
  check. Python now refuses these values, which the Node SDK already refused
  and the Python models accepted: a lowercase `t` between date and time, a
  time without seconds, a unix timestamp string, and a URL with a space, a
  non-ASCII character, a `%zz` escape or a trailing newline. The Python models
  can still refuse a few values the schema allows, for example
  `2025-02-30T12:00:00Z`, a tab between date and time, or the URL `https://`.
- The message of a missing-field validation error names the field's full
  path in all three SDKs, for example `Missing required field:
  email.content.raw` instead of `Missing required field: raw`. Code that
  matches on the message text needs updating; `field` and `suggestion` are
  unchanged.
- Node and Go report a payload without `email.content.raw` as missing
  `email.content.raw`, as Python already did, rather than as an error on
  `email.content.download` or `email.content`. The email event schema accepts
  and refuses the same payloads as before.

#### Route write answers and share email refusals

- `createRoute` and `updateRoute` answer `data` as the route plus its
  `warnings`, so the generated type of `data` is new: in Go
  `CreateRouteCreatedData` and `UpdateRouteOKData` instead of
  `RecipientRoute`, and in Python `CreateRouteResponse201Data` and
  `UpdateRouteResponse200Data`. Read the same route fields from it.
- Go: `ListEmailRuleShareEmailsConflict` is gone, as the operation no longer
  answers `409`, and so is the error code `email_rule_not_active`
  (`ErrorResponseErrorCodeEmailRuleNotActive` in Go,
  `ErrorResponseErrorCode.EMAIL_RULE_NOT_ACTIVE` in Python).

#### Endpoint answers

- `updateEndpoint` answers `data` as the endpoint plus its `warnings`
  (`UpdatedEndpoint`), so the generated type of `data` is new: in Go
  `UpdatedEndpoint` instead of `Endpoint` on `UpdateEndpointOK`, and in
  Python `UpdatedEndpoint` on `UpdateEndpointResponse200`. Read the same
  endpoint fields from it. In Go its nested enum, option and rules types are
  `UpdatedEndpoint*` too (for example `OptUpdatedEndpointKind` and
  `UpdatedEndpointRules`), so code that compares them with the `Endpoint*`
  types needs updating; Python reuses the `Endpoint*` enums.
- Giving a webhook the organization does not own to a different key, or a
  key's webhook back to the organization, turns it off unless the same
  `updateEndpoint` request sets `enabled`: it then reads `enabled` false with
  `disabled_reason` `owner_changed`, and the answer's `warnings` say so.
- `testEndpointRules`: `would_deliver` also covers the endpoint's own
  delivery conditions (it is on, neither it nor the email's route is held, its
  owner may receive the email, and it subscribes to the event), and `rule`
  names the first check that stops the email: `disabled`, `held` or an
  `acting_owner_*` code, then `event_types`, then the name of the rule that
  does not match. `rule` is no longer always a rule's name.
- A URL can have one endpoint per domain, route targets included, and
  endpoints with no `domain_id` count as one domain. A disabled endpoint still
  holds its URL; a deleted one does not. `createEndpoint` at a deleted
  endpoint's URL makes a new endpoint with a new id and leaves the deleted one
  as it was, instead of bringing the deleted endpoint back with its old id. A
  URL another endpoint has on the same domain, a disabled one included, is
  refused with `400`. `updateEndpoint` onto such a URL is refused with `400`,
  and a move onto a domain where another endpoint has the URL with `409`.

#### Email list meta

- `listEmails` answers `meta` as `EmailListMeta`, the pagination fields plus
  `recipient_outside_access` and `recipient_rules_only`, and declares
  `total_capped` and `total_unavailable`. In Go
  `ListEmailsOK.Meta` is `EmailListMeta` instead of `PaginationMeta`, and in
  Python `ListEmailsResponse200.meta` is `EmailListMeta`. Node's
  `EmailListMeta` extends `PaginationMeta`.

#### Mail domain filter

- `listEmails` and `searchEmails` no longer take `domain_id`; they take
  `domain_ids`, domain ids comma-separated or with the key repeated, at
  most 50. In Python the `domain_id` argument is gone and `domain_ids` is a
  `str`; in Go `DomainID` is gone and `DomainIds` is an `OptString`. The
  generated CLI commands take `--domain-ids` in place of `--domain-id`.

#### CLI domain focus

- On a credential that reads mail on more than one domain, `emails list`,
  `emails latest`, `emails search`, `search`, `emails watch`, `inbox next`,
  `sent list` and `semantic-search` stop with exit 2 and error code
  `focus_required` until a focus is chosen with `primitive focus set
  <domain...>` or `primitive focus set --all`, or the command passes
  `--domain <name>` or `--all-domains`. A credential that reads one domain
  is unaffected.
- `search --domain` and `emails watch --domain` take a domain name as the
  focus for that command instead of adding a `domain:` filter to the query.

#### Email rule decision time

- Email rule decisions carry `decided_at` in place of `created_at` on
  `listEmailRuleDecisions` and `listEmailRuleDecisionsOnMyMail`
  (`decided_at` in Python, `DecidedAt` in Go).
- In Python and Go, the made-up emails `testEmailRule`'s `expect.samples`
  takes are `EmailRuleTestSampleInput`, which takes an optional `group`;
  `EmailRuleExpectationSampleInput` stays the type of a rule's saved
  made-up emails.

#### CLI missing request fields

- A generated command missing a required request body field stops before
  authentication or any request with exit 2 and error code `usage_error`,
  listing each field in `error.details.missing` (`field`, `flag`,
  `json_path`). An `--event-types` value that cannot be used is refused
  before authentication.

#### CLI command names

- Command paths use shorter names, such as `primitive emails list` (was
  `emails list-emails`), `primitive email-rules create` (was
  `email-rules create-email-rule`), `primitive account get` (was
  `account get-account`), `primitive sending list` (was
  `sending list-sent-emails`) and `primitive org list` (was `orgs`). Verbs
  are the same across commands, so `routes add` is `routes create`,
  `routes remove` is `routes delete` and `functions route-set` is
  `functions set-route`. A
  removed spelling, including a 1.x generated command name, does not run:
  it exits 2 with error code `command_not_found` and names its
  replacement. API operation names, routes, request fields and SDK methods
  are unchanged. Command names elsewhere in these notes are those of the
  preview that introduced them.
- Email rule commands take `--scope`, `--samples-file` and
  `--add-samples-file` in place of `--evaluation-scope`,
  `--expectation-samples-file` and `--add-expectation-samples-file`.
- Positional arguments are read only from the command line. Piped stdin no
  longer fills in a missing argument such as an id; only a command that
  takes a body, secret or hook input from stdin reads it.

#### CLI `--json` output

- `--json` on every generated command prints the API's response body
  (`data`, and `meta` with `meta.cursor` where the route sends it) plus the
  CLI's own `summary`, `warnings`, `error` and `exit_code`, where 1.x printed
  the data payload alone. Read a list as `.data[]` and an object's fields as
  `.data.<field>`, and page with `meta.cursor`. Without `--json`, stdout is
  still the data payload, except for `sent list` and `sending list`, which
  print a table.
- `activity created`, `asked` and `concerning` with `--json` print
  `{data, meta}`: the rows in `data`, and `covers`, `withheld` and the
  next page's `cursor` in `meta`.
- `--envelope` is removed from every command that had it.
- The CLI's own notes go in `warnings`, or in `cli_warnings` when the
  document already has a `warnings` of its own.

#### CLI sent list default

- `sent list` (and `sending list`) lists your own sends: it
  sends `mine=true` unless `--all-senders` or `--mine` is given.

#### Endpoint event types

- `createEndpoint` refuses an http webhook created without
  `rules.event_types`. `family.*` names are expanded on write and unknown
  names are refused.
- `primitive endpoints create` sends `rules.event_types: ["email.received"]`
  for a webhook when no event types are named. On `endpoints update`,
  `--event-types` replaces the stored list.

#### CLI sender default

- `send` and `chat` no longer default `--from` to `agent@` at the first
  verified domain for a person or an organization-wide key, so a script that
  sends with such a key and no `--from` now exits 1 and sends nothing.
  Without `--from`, a connected agent sends as its agent address; your own
  login sends as your member address (as `account whoami` reports it) when
  the API would let you send from it to that recipient; and an organization
  or Function key whose grant names exactly one address, and no whole domain,
  sends from that address. Otherwise nothing is sent: the command lists the
  addresses and domains you may send from and asks for `--from`. `send` names
  the From it used on stderr, and its `--json` envelope carries `from`.
  Where the API answers `getSendFrom`, the CLI takes the default, and the
  list of what you may send from, from that answer, which judges each address
  by the send's own rules; against an API without it, and for a Function-bound
  key, which may not ask, the CLI works them out as above. If that answer
  cannot be read, nothing is sent and the command asks for `--from`.
  When `chat` is run without `--from` within a day of a chat an earlier
  version left unfinished under its old `agent@` default, and it is the same
  message, `chat` stops with outcome `uncertain` (exit 4) instead of sending
  it again, and names that chat's From and idempotency key.

#### CLI prompts and usage errors

- Unless stdin and stderr are both terminals, `primitive login <email>`,
  `signin <email>`, `login otp`, `signin otp`, `otp` and `signup` need
  `--accept-terms`. An answer piped on stdin (`echo yes | ...`) no longer
  accepts the terms, and continuing a pending code also needs the flag.
- Without a terminal, `primitive agent upgrade` always exits 2 (use `agent
  claim` and `agent claim-verify`), and `org leave` without `--yes` exits 2
  instead of 1.
- `primitive agent upgrade --code` exits 2 with or without a terminal: the
  command emails a new code, which replaces the one passed in. Use `agent
  claim-verify --verification-code <code>` for a code you already have.
- `primitive signup confirm` with no code source, more than one, or one that
  cannot be read exits 2 instead of 1, with or without a terminal.
- An error the CLI raises carries a `code` under `--json`: `usage_error`
  (exit 2) for a refusal before anything was sent, such as a bad flag or a
  file it cannot read or parse, and `cli_error` otherwise.

#### CLI whoami and role text

- `primitive whoami` text output changed: the first line names your member
  address instead of the account's email, and the role line reads
  `Built-in role:`. A script that reads the email should use `whoami --json`
  and its `email` field, which is unchanged. API keys and other credentials
  that are not a person's login no longer print a role line; read `role`
  from `whoami --json --grant`. `org list` rows read `built-in role <key>`,
  a `restricted` role reading `built-in role member` followed by a note
  line saying what else that label can mean, `org use` labels the role the
  same way, `org list --json` and `org use --json` report a `restricted`
  role as `member`, and `roles groups` rows read `role id`.
- For an API key, the `Grant:` line of `primitive whoami` names the key id.
  For a key whose scope lists email rules it names them by id (`mail that
  email rule <id> granted, while it stays active`, the first three and how
  many more) instead of `a narrowed mail scope`, since a key cannot read the
  rules themselves. A scope the server could not read, or one that names no
  mailbox, domain or rule, says it reaches no mail.

#### CLI doctor output

- `primitive doctor` without `--json` prints the readable checklist on
  stdout and no JSON. A script that reads its JSON summary from stdout
  passes `--json`, which prints only that summary, with nothing on stderr.
  In 1.75.0 every run printed the checklist on stderr and the JSON on
  stdout.

### Additions

#### Conversation sync helper

A helper in each SDK brings a conversation up to date with incremental
`since` reads of `GET /emails/{id}/conversation`, paging through `has_more`.
It upserts messages by `id`. Two entries are the same message when either
one's id is in the other's `copies` or `sent_email_id`, and the newer one
replaces the held one. The list is kept ordered by timestamp: a timestamp
without an offset is read as UTC, and one that is not a valid RFC 3339
date-time is kept as null and sorts last. A sync stops with an error after
1000 pages. The three SDKs behave the same, pinned by
`test-fixtures/conversation-sync.json`.

- Node: `syncConversation(client, emailId, state?, options?)`,
  `mergeConversationMessages(held, delta)` and `MAX_CONVERSATION_SYNC_PAGES`,
  from `@primitivedotdev/sdk/api`.
- Python: `sync_conversation(client, email_id, state=None)` returning
  `ConversationSync`, `merge_conversation_messages(held, delta)` and
  `MAX_CONVERSATION_SYNC_PAGES`.
- Go: `SyncConversation(ctx, reader, emailID, state)`,
  `Client.SyncConversation(ctx, emailID, state)`,
  `MergeConversationMessages(held, delta)` and `MaxConversationSyncPages`.
  With the generated `*primitiveapi.Client` as the reader, an error answer
  becomes an `APIError` with its status, code, request id and `Retry-After`.

#### New operations

184 operations, by area:

- Account: `getOwnGrant`, `getSendFrom` (the addresses a credential may
  send from, and the one a send that names no From should use).
- Activity: `listActivityObjects` (what the caller created, newest first,
  with where each object stands now: for a person, through any credential of
  theirs; for a key, an app or an agent, what it created itself).
- Address notes: `listAddressNotes`, `listAddressNotesBatch`,
  `getAddressNote`, `putAddressNote`, `deleteAddressNote`,
  `listPublicAddressNotes`, `getPublicAddressNote`.
- Agent connections: `setAgentConnectionVisibility`,
  `renameAgentConnection`, `getAgentConnectionSettings`,
  `updateAgentConnectionSettings`, `getOwnAgentConnection`,
  `agentConnectionTrustedOrigins`.
- Agent work: `agentWorkGet`, `agentWorkCreate`, `agentWorkList`,
  `agentWorkProposeDeadline`, `agentWorkReportStatus`,
  `agentWorkManageState`, `agentWorkAgreeDeadline`,
  `agentWorkWithdrawDeadline`.
- CLI: `listCliOrgs`.
- Contacts: `prepareContactRequest`, `prepareContactAcceptance`.
- Credentials: `listCredentials`, `revokeCredential`,
  `revokeAllCredentials`, `listCredentialEvents`, `getCredentialPolicy`,
  `updateCredentialPolicy`, `getKeyBuilder`, `listKeys`, `createKey`,
  `rotateKey`, `getKey`, `updateKey`, `getKeySuggestion`.
- Domains: `getDomainAgentAuthorization`, `checkVanityInboxName`,
  `claimVanityInboxName`.
- Email rules: `compileEmailRule`, `testEmailRule`, `testEmailRuleOnSample`,
  `listEmailRules`, `createEmailRule`, `getEmailRule`, `updateEmailRule`,
  `deleteEmailRule`, `listEmailRuleDecisions`, `listEmailRuleVersions`,
  `getEmailRuleScope`, `listEmailRuleScopeOptions`, `listEmailRuleResults`,
  `getEmailRuleVocabulary`, `generateLookAlikes`.
  A rule's `evaluation_scope` chooses whose mail it runs over (`author`,
  `own_mailboxes`, or `selected` with `scope_selection` naming addresses and
  domains), never more than its author can read. A rule's `kind` is `grant`
  (the default) or `do_not_share`, a rule that, while it is active, keeps
  what it matches (and any email it cannot decide) from being shared; it is
  set on `createEmailRule` (the CLI's `--kind`), can be tested on an unsaved
  tree with `testEmailRule` and `testEmailRuleOnSample`, and is returned on
  rules and on `listEmailRuleResults`. A new rule's `evaluation_scope` is
  `own_mailboxes` when omitted. Rules, including the one an accepted request
  writes, carry their `evaluation_scope` and `scope_selection`, and
  `listEmailRuleScopeOptions` says with `may_name_unlisted` whether you may
  name an inbox its list does not show.
- Emails: `getEmailReadable`; `importGoogleMailMessage`, which imports one
  historical Google Workspace message into the organization's configured
  mailbox, fetched by the API itself with a transient provider token sent
  only in the `X-Primitive-Google-Access-Token` header; and
  `reconcileGoogleMailImport`, which recovers import attempts that expired.
  Both are for the configured owner only, and importing needs the
  organization's `email_import` entitlement. `importGoogleMailMessage`
  takes a credential header and is not a CLI command.
- Endpoints: `getEndpoint`, `getEndpointSigningSecret`,
  `rotateEndpointSigningSecret`.
- Functions: `lookupFunction`, `getOrgFunctionUsage`,
  `getOrgFunctionInvocationSeries`, `getOrgFunctionFallback`,
  `redeployFunction`, `updateFunctionTags`, `listFunctionDeployments`,
  `getFunctionDeployment`, `getFunctionSource`, `getFunctionUsage`,
  `getFunctionUsers`, `listFunctionActivity`, `listFunctionInvocations`,
  `getFunctionInvocation`, `listFunctionRuntimeKeyPresets`,
  `requestFunctionRuntimeKeyRunner`, `getFunctionRuntimeKey`,
  `setFunctionRuntimeKey`, `suspendFunctionRuntimeKey`,
  `reaffirmFunctionRuntimeKey`.
- Inbox: `listMailRouting`, `updateMailRouting`, `listMailTopicEdits`,
  `updateMailTopicEdits`, `listMailTopicGenerations`,
  `updateMailTopicGenerations`.
- Interactions: `listInteractions`, `startInteraction`, `getInteraction`,
  `sendInteractionStep`.
- Mailbox access: `listMailboxAccess`, `setMailboxAccess`, `listGroups`,
  `createGroup`, `updateGroup`, `deleteGroup`.
- Organization settings: `listMyGrants`, `revokeMyGrant`, `listOAuthGrants`,
  `revokeOAuthGrant`, `getOrganization`, `updateOrganization`,
  `updateOrganizationLogo`, `removeOrganizationLogo`, `getSearchSettings`,
  `updateSearchSettings`, `getEmailRuleSettings`, `updateEmailRuleSettings`
  (whether email rules read PDF and image attachments, for a person only).
- Organizations: `listOrganizationInvitations`, `inviteOrganizationMember`,
  `revokeOrganizationInvitation`.
- Projects: `listOrganizationPeople`, `listProjects`, `createProject`,
  `getProject`, `updateProject`, `deleteProject`, `listProjectInvitations`,
  `inviteProjectMember`, `revokeProjectInvitation`.
- Roles and members: `listRoles`, `createRole`, `updateRole`, `deleteRole`,
  `setMemberRole`, `removeMember`, `getAccessMode`, `setAccessMode`,
  `decideAccessMode`, `listBreakGlass`, `startBreakGlass`, `endBreakGlass`,
  `listOwnedItems`, `transferOwnedItems`, `listSuspensions`,
  `decideSuspension`, `setOwnMailboxAccess`, `removeOwnAgentAccess`.
  `leaveOrganization` moves here from Account.
- Email rule requests: `createEmailRuleRequest`, `listEmailRuleRequests`,
  `getEmailRuleRequest`, `acceptEmailRuleRequest`, `declineEmailRuleRequest`,
  `withdrawEmailRuleRequest`, `deleteEmailRuleRequest`,
  `checkEmailRuleRequestTarget`.
- Email rule oversight: `listEmailRulesCoveringMe` and `getEmailRuleCoveringMe`
  (`GET /email-rules/covering-me` and `/email-rules/covering-me/{id}`), the
  rules that reach your own mailboxes, whoever wrote them, read-only
  (`EmailRuleCoveringMe`, `EmailRuleCoveringMeRead`: `name`, `state`,
  `kind`, `author`, `is_author`, `covers` as `EmailRuleCoverage` with the
  `addresses` it reaches and `via`, and the current version), and
  `listEmailRuleDecisionsOnMyMail` (`GET /email-rules/covering-me/{id}/decisions`,
  `EmailRuleDecisionOnMyMail`, with `matched`, `limit` and `cursor`), what
  such a rule decided about mail at your own mailboxes, never anyone else's.
  A rule you can read only because it decided on your mail before has
  `covers_now` false, a `note` saying what is withheld, `name`, `covers`,
  `current_version` and `receivers` null, and as `current` the newest
  version that decided on your mail. Each covering rule carries `receivers`
  (`EmailRuleReceivers`): the working API keys and webhooks that receive
  what it shares, each by its owner and a count, and its live share by the
  member it gives to; null when they could not be read in time. They need
  `mail:read` on a member's own
  session or the CLI, not narrowed. `listEmailRuleVersionsCoveringMe`
  (`GET /email-rules/covering-me/{id}/versions`) reads the versions of such
  a rule that applied to your mail: its current version and each earlier
  one that decided on mail at your own mailboxes, with the wording, tree,
  explanation and assumptions the covering view shows. In the CLI:
  `email-rule-oversight list-covering-me`,
  `get-covering-me`, `list-decisions-on-my-mail` and
  `list-versions-covering-me`.
  Objections (`/email-rule-objections`, each an `EmailRuleObjection`) ask
  the author of a rule that covers one of your own mailboxes now to turn
  it off: `createEmailRuleObjection` (`rule_id` and an optional `message`),
  `listEmailRuleObjections` (`box` `mine`, the default, objections you made
  and those to rules you wrote, `outgoing`, `incoming` or `all`, with each
  objection's `is_objector` and `is_author` saying which side you are on;
  `status` `pending`, the default, `decided` or `any`),
  `getEmailRuleObjection`, `withdrawEmailRuleObjection` (by the member who
  objected), and `declineEmailRuleObjection` (with an optional `reason`),
  `acceptEmailRuleObjection` (which turns the rule off, state `draft`) and
  `amendEmailRuleObjection` (status `amended`, with an optional `note`,
  once the author has saved a newer version of the rule; until then it
  answers `409` `conflict` with `details.reason` `no_new_version`,
  `details.objected_version` and `details.current_version`) by the rule's
  author. An objection carries `rule.objected_version`,
  `rule.amended_version` and `amend_note`. A decided or withdrawn objection answers `409`
  `not_pending`; a second pending objection to the same rule, or one more
  while you have 50 pending, answers `409` `conflict` with `details.reason`
  `objection_pending` or `objection_limit`; accepting an objection to a
  rule since deleted answers `409` `conflict` with `details.reason`
  `rule_deleted` (decline it instead). They need the same credential
  as the reads above. In the CLI: `email-rule-oversight
  create-email-rule-objection`, `list-email-rule-objections`,
  `get-email-rule-objection`, `withdraw-email-rule-objection`,
  `decline-email-rule-objection`, `accept-email-rule-objection` and
  `amend-email-rule-objection --id <objection-id> --note <text>`.
- Email notifications: `getEmailNotificationPreferences` and
  `updateEmailNotificationPreferences`, the notification emails the calling
  member gets and turning a kind on or off where the organization lets
  members choose, and `getEmailNotificationSettings` and
  `updateEmailNotificationSettings`, the organization's mode for each kind
  (`off`, `optional_on`, `optional_off` or `required`). For a person only,
  not an API key or an agent. They are not CLI commands yet.
- Email rule shares: `listEmailRuleShares`, `listGivenEmailRuleShares`,
  `getEmailRuleShare`, `listEmailRuleShareEmails`, `endEmailRuleShare`
  (whose answer carries a `note` saying the rule itself is left unchanged,
  and, to the member who shared, the rule's `rule_id`).
- Relay auto join: `getRelayAutoJoin`, `setRelayAutoJoin`.
- Sending: `downloadSentAttachments`, `signalEmail`, `checkSendability`,
  `releaseSentEmail`, `sendMailBatch`.
- Stats: `getInboundHourlyStats`, `getSentHourlyStats`,
  `getWebhookDeliveryStats`.
- Templates: `updateFunctionFromTemplate`.
- Threads: `listMutedThreads`, `muteThread`, `unmuteThread`,
  `markThreadRead`, `listThreadReadStates`.
- Webhook deliveries: `getDelivery`.

#### New parameters and fields on existing operations

- `rotateKey` takes `expires_at`: the new key's expiry, a time or null for
  none, instead of the old key's.
- `listActivityObjects` takes `relation`: `created` (the default), `asked`,
  what other members asked of you: rule requests made to you, and
  objections to rules you wrote, or `concerning`, what other members' rules
  did to your own mail. Its `kind` can be `email_rule_objection`: with
  `created`, your own objections (on the dashboard or in the CLI only);
  with `asked`, the objections to rules you wrote. With `concerning` the
  only kind is `email_rule_coverage`, a coverage notice (on the dashboard or
  in the CLI only): its `state` is `started` (a rule began covering one of
  your mailboxes), `new_version`, or `baseline` (it already covered you when
  notices began), its `name` is the rule's name then, and
  `created_through` names the rule's author.
- A rule request's `share_terms` says, for the member asked while it is
  pending, what accepting would share. A rule
  request's `warnings` are those the member who asked sent, then every
  compiler note on the rule's tree and words they lack. A rule saved by
  `createEmailRule`, `updateEmailRule` or `acceptEmailRuleRequest` keeps
  the `warnings` sent, then any server note they lack on an address or
  domain the description names that the rule does not test.
- A rule listed `read_only` in `listEmailRuleResults` carries `receivers`
  (`EmailRuleReceivers`) while it covers you, and null otherwise.
- `listDeliveries` takes `endpoint_id`: only deliveries to that endpoint.
- Emails carry `imported`: null for live mail, and for a historical message
  Primitive acquired, where it came from (`from`, `method`, `verification`)
  and when (`at`). It is required, and nullable, on email details, list and
  search rows (and the change feed's expanded messages), readable emails and
  a share's emails, and optional on a conversation's messages.
- `createEndpoint` answers with `warnings` (`EndpointCreateWarning`):
  `same_path_as_another_endpoint`, with the other webhook's `endpoint_id`,
  when another webhook you can see sends to the same scheme, host and path.
- `getKey`, `listKeys` and `listCredentials` carry each key's
  `address_warnings`, notes on its grant worked out on every read. On
  `getKey` and `listKeys`, `grant.mail_scope.rule_versions` gives each rule
  the key lists directly its `current_version`, `state` and
  `version_saved_at` (documented in the operations' descriptions, not
  typed).
- `compileEmailRule` answers with `rule` (`english`, `kind`, `tree` and,
  when one was given, the scope), beside `explanation`, `assumptions` and
  `warnings`. It is the body `createEmailRule` and `updateEmailRule` take,
  and the body `createEmailRuleRequest` and `acceptEmailRuleRequest` take
  when compiled without a scope, since those two take no scope fields.
  The `rule` that `testEmailRule`, `testEmailRuleOnSample` and
  `generateLookAlikes` answer with is `EmailRuleTested`, with its `kind`
  and `warnings`. On an update `kind` must be the rule's own (`400`
  `validation_error`, `kind_mismatch`).
- One expectations gate judges, before saving, an `updateEmailRule` that
  leaves a rule active on a new version or turns it active, and a
  do-not-share rule created active: a failed expectation refuses it (`409`
  `expectations_failed`), and so does an undecided one on a grant rule
  (`409` `expectations_undecided`, with `details.retryable`); a
  do-not-share rule is saved with undecided ones. A judgment that finishes
  too late answers `503` `judged_too_late`, and `503`
  `service_unavailable` (`rule_keys_unread`) says the keys listing an
  active rule could not be read in time. Nothing is saved in either case.
- `testEmailRule` can test a rule you see only because it covers your own
  mailboxes, run as you over only those, from the dashboard or the CLI.
- Relay auto join: auto-joined people have no mail access until an owner or
  admin assigns a role. Legacy mail-grant choices read as `no_access` and
  cannot be set, and `setRelayAutoJoin` no longer answers `409`
  `role_key_taken`.
- New error codes: `chunk_size_mismatch` and `invalid_manifest`.
- `getEmail` answers `attachments` at the top level: each attachment's
  metadata (file name, type, size), in the order of `parsed.attachments`,
  and kept for a credential that reads headers only, where `parsed` is null.
  It is required on `EmailDetail`, so the Python and Go clients expect it.
  Each carries `description`, a one-line description read from the file
  where the organization has attachment reading on, else null.
- A made-up email takes `attachment_names`, its attachments' file names,
  paired with `attachment_types` by position (the same number of each when
  both list files): in `testEmailRuleOnSample`, in the expectation samples
  rule writes and tests take and rule reads return, and in
  `generateLookAlikes`' look-alikes, where it is required.
- `updateKey` answers `rules_added` when an edit puts rules on a key that
  reads mail: each rule's `id` and `granted_emails`, how many emails it has
  already shared, which the key can now read (counted up to 10,000, with
  `more: true` past that; null when not counted).
- `testEmailRule`'s `summary` carries `conditions_held`: of the emails
  decided, how many its conditions alone held for. On a test of the recent
  window, a grant rule whose conditions held for more than 20% of at least
  20 emails checked (at least 90% if it has no questions), or for every one
  of fewer, gets a warning saying so.
- A grant rule whose conditions test only who an email was sent to gets a
  server note in the `warnings` that `createEmailRule`, `updateEmailRule`
  and `acceptEmailRuleRequest` keep.
- `compileEmailRule` takes `evaluation_scope` and `scope_selection`, as a
  test does, and its `rule` carries them. Nothing is saved. With `selected`
  it can answer `409` `email_rule_author_unresolvable`.
- `createEmailRule` and `updateEmailRule` answer the rule's saved
  `expectations` (`match` and `no_match`, by email id, as stored): on every
  create, and on an update that set or removed them.
- `sendEmail`, `sendMailBatch` and `replyToEmail` take `unsubscribe`: a
  one-click unsubscribe `url` (https, public host, at most 700 characters),
  an optional `mailto`, and `one_click` (default true). Primitive writes
  and DKIM-signs `List-Unsubscribe` and, unless `one_click` is false,
  `List-Unsubscribe-Post` (RFC 8058). The `headers` map refuses both
  names, and a repeating send refuses `unsubscribe`.
- `testEmailRuleOnSample` and `generateLookAlikes` take as `rule_id` a
  rule that covers your mailboxes, run as you (on the dashboard or the CLI
  only).
- `getKeyBuilder` answers `mail_limits_available`, whether a key limited to
  some mail would be created now, and `org_reach_available`, whether the
  credential policy lets a new key reach every mailbox.
- New error codes: `always_sent` and `required_by_organization`.
- `testEmailRule` and `testEmailRuleOnSample` take `request_id`, a pending
  rule request you can see, tested as you over your own mailboxes.
- `testEmailRule`'s `window` carries `scope`, the scope the test ran with,
  and `oldest_at` and `newest_at`, the span of the emails tested.
- `createEmailRuleRequest` with an `Idempotency-Key` answers `200` with
  `existing: true` and the pending request it matched, instead of making a
  second one, when you already asked that member exactly this.
- `rotateKey` answers the successor's `name`, its `grant` (the rotated
  key's, carried over unchanged) and `rotated_from`.
- `listActivityObjects` coverage notices (`email_rule_coverage`) carry
  `rule_id`, the rule each is about.
  A notice's `started` means a rule in observe or active came to cover your
  mailboxes: made, turned on, or reaching you, once per rule; a draft rule
  gets none.
- A new version of a shared rule keeps its share: what the version matches is
  shared from the next email on. Only the rule's author, on the dashboard or
  the CLI, can save a new version of a shared rule; another app or agent
  acting for them is refused with `403 forbidden` (`details.reason`
  `first_party_required`).
- A rule's author, on the dashboard or the CLI, reads `pending_objections` on
  it (from `listEmailRules`, `getEmailRule` and rule writes). A write's answer
  leaves the count out when it could not be read in time.
- `downloadDomainZoneFile` takes `inbound_only`: only the inbound MX and
  ownership TXT records, not with `outbound_only`. Without either, the file
  has every record.
- New error codes for mail import: `mail_import_cap_exceeded`,
  `mail_import_content_mismatch`, `mail_import_deadline`,
  `mail_import_disabled`, `mail_import_fenced`, `mail_import_forbidden`,
  `mail_import_invalid_input`, `mail_import_invalid_provider_response`,
  `mail_import_out_of_window`, `mail_import_policy_mismatch`,
  `mail_import_provider_auth`, `mail_import_provider_unavailable`,
  `mail_import_storage_failed`, `mail_import_storage_limit`,
  `mail_import_too_large` and `mail_import_unavailable`.
- For a caller who cannot read the webhook, a delivery's `response_body`
  is null, its `last_error` gives the status and a note without quoting
  the webhook's answer, and its `last_error_code` is `handler_4xx` or
  `handler_5xx` in place of a code the webhook chose. In answers recorded
  since November 2026, `response_body` hides the webhook URL's query
  string, its parameters, values long enough to be a credential and any
  userinfo, and keeps the rest as the endpoint wrote it.
- `deleteEmailRule` answers `ended_shares`, `keys` and `other_keys` beside
  `deleted` (`DeleteEmailRuleResult`): the shares the delete ended, the keys
  that are not revoked and still list the rule that you may read, by id, name
  and prefix, and how many more there are. Those keys now read nothing through
  the rule. An email rule share's `end_reason` can be `rule_deleted`. Key
  reads (`listKeys`, `getKey`, `listCredentials`) show a rule a key lists that
  reads nothing any more under `grant.mail_scope.ended_rules`, with its `id`
  and a `reason`, `rule_deleted` or `share_ended`.
- `createEmailRuleRequest` takes `message`, up to 500 characters, telling the
  member asked why you are asking. `declineEmailRuleRequest` takes an optional
  body with `reason`, up to 500 characters (`DeclineEmailRuleRequestRequest`).
  A rule request carries both as `message` and `decline_reason`. In Go,
  `DeclineEmailRuleRequest` takes the body as a new argument: pass
  `api.OptDeclineEmailRuleRequestRequest{}` to decline without a reason.
- `Primitive-Step-Up` is a declared header parameter on the 36 operations that
  accept a step-up confirmation token, so a client can send the confirmation
  token through the generated call: `headers: { "Primitive-Step-Up": token }`
  in Node, `primitive_step_up=` in Python, and `PrimitiveStepUp` on the
  operation's params in Go. They are `createAgentConnection`,
  `inviteAgentConnection`, `inviteOrganizationMember`, `inviteProjectMember`,
  `setMailboxAccess`, `createGroup`, `updateGroup`, `deleteGroup`,
  `createKey`, `rotateKey`, `updateKey`, `updateOrganization`,
  `updateOrganizationLogo`, `removeOrganizationLogo`, `updateSearchSettings`,
  `createRole`, `updateRole`, `deleteRole`, `setMemberRole`, `removeMember`,
  `leaveOrganization`, `setAccessMode`, `decideAccessMode`, `listBreakGlass`,
  `startBreakGlass`, `endBreakGlass`, `listOwnedItems`,
  `transferOwnedItems`, `listSuspensions`, `decideSuspension`,
  `setOwnMailboxAccess`, `removeOwnAgentAccess`, `setRelayAutoJoin`,
  `createEndpoint`, `updateEndpoint` and `revokeCredential`.
- The `Idempotency-Key` descriptions say which operations do not perform the
  action again when a request is retried with the same key (`replyToEmail`,
  `startInteraction`, `sendInteractionStep`) and which do not use the key to
  deduplicate.
- The attachment downloads declare their `503` answers with `Retry-After`
  and the `ratelimit-*` headers (in Go, `...ServiceUnavailable` types of
  `ErrorResponseHeaders`). `downloadAttachments` and `downloadSentAttachments`
  declare `409`, and `downloadAttachments` also `403`, `410` and `500`.
- `listEmails`: `thread_id`, `exclude_muted`, `search_regex`,
  `search_case_sensitive`, `search_negate`, `kind`, `content_discarded`,
  `group`, `include_presence`. Email summaries gain `copies`,
  `copies_truncated`, `sent_email_id`, `snippet`, `muted`, `parse_status`,
  `in_reply_to`, `references` and `delivery_report`.
- `getConversation`: window reads with `around`, `before`, `after` and
  `limit`, answered with `before_cursor`, `after_cursor`, `has_more_before`
  and `has_more_after`; `text=readable`; and `has_more` on a `since` delta.
  Conversation and thread messages gain `copies`, `copies_truncated` and
  `sent_email_id`.
- `getThread`: `after`.
- `listSentEmails`: `since`, `wait`, `domain_ids`.
- `searchEmails` and the `semanticSearch` body: `domain_ids`. A filter by
  `domain_ids` only narrows, and the list, search, sent and semantic search
  answers echo the ids in `meta.domain_ids`.
- `listAgentConnections`: `include_hidden`.
- `whoami`: `include`, `check`, `resource`.
- Email rules:
  - `compileEmailRule` takes `kind`.
  - `createEmailRule` and `updateEmailRule` take `expectations` (the emails a
    rule should and should not match), and their answers carry
    `expectations_check` and `scope_warnings`.
  - `getEmailRule` carries `expectations`.
  - A rule carries `revision`, which moves on with every update, and
    `author` (`EmailRuleAuthor`: `user_id`, and `name` and `email` when you
    may see them).
  - `updateEmailRule` takes `if_revision`, refused with `409`
    `email_rule_conflict`, `details.reason` `revision_moved` and
    `details.current_revision` when the rule was updated since.
  - `updateEmailRule` takes `restore_version`, which saves an earlier
    version again as the next one.
  - After an update that saved a version, or turned a grant rule active,
    the `updateEmailRule` answer carries `affects` (`keys`, `webhooks` and
    `shares`): your own keys and webhooks that receive what it grants from
    now on, and how many live shares it has.
  - An `email_rule_conflict` can also have `details.reason`
    `version_moved`, `expectations_moved` or `rule_changed`.
  - A rule can keep made-up emails as expectations, at most 20:
    `createEmailRule` takes `expectation_samples`
    (`EmailRuleExpectationSampleInput`: `expected` `match` or `no_match`,
    an optional `label`, and an `email` as `EmailRuleSavedSampleEmail`).
    `updateEmailRule` takes `expectation_samples`, which replaces them (null
    or `[]` removes them), or `add_expectation_samples`, which adds to them,
    not both; more than 20 is refused with `400` and
    `too_many_expectation_samples`. `getEmailRule`, and a write that set or
    added some, carry `expectation_samples` (`EmailRuleExpectationSample`,
    with `id` and `created_at`).
  - `testEmailRule`'s `expect` takes `samples`, up to 20 made-up emails, with
    emails by id or alone. Its `expectations` carry `samples`
    (`EmailRuleSampleJudgment`: `index` from 0, `sample_id`, `label`,
    `expected`, `outcome`, `status` and `question_answers`) for those sent,
    or for a saved rule's own, and its counts include them.
  - A write's `expectations_check` carries `failed_samples` and
    `undecided_samples`, the made-up emails by index from 0. A saved write
    lists its rule's made-up emails as undecided without judging them; a
    write the expectations gate judges judges them before saving, along with
    its emails by id.
  - `generateLookAlikes` (`POST /email-rules/look-alikes`) writes made-up
    emails that come close to what a grant rule (an unsaved `tree`, with
    its `english`, `evaluation_scope`, `scope_selection` and `kind`, a
    saved `rule_id`, or a pending rule request's `request_id`) describes,
    and answers what the rule decides for each: `rule`, `look_alikes`
    (`EmailRuleLookAlike`: `kind`, `expected`, `why`, `email`, `outcome`,
    `status`, `question_answers`), `counts` and `note`. Most are expected
    not to match (`expected` `no_match`); without `kinds`, a third of them
    are near cases the rule should match (`expected` `match`). `status`
    `failed` means the rule decided one against its `expected`.
    Nothing is stored. It takes `count` (1 to 8, 6 by default), `kinds` and
    `to`. A do-not-share rule is refused with `400` and `details.reason`
    `do_not_share`; a request you cannot see is `404` `not_found` with
    `details.reason` `request_not_found`, and one already decided `409`
    `email_rule_request_not_pending`; none
    written is `422` `email_rule_look_alikes_not_written`, and an
    unavailable writer `503` `email_rule_compiler_unavailable`. It is
    limited to 20 calls an hour per member.
  - `createEmailRule` takes `state` `active` for a `do_not_share` rule. A
    do-not-share rule's
    answers carry `protection_note`: that it protects nothing yet, that a
    classifier fact narrows it, or that its several questions are
    alternatives (any one answered yes blocks).
  - `compileEmailRule`'s `warnings` also note a rule reading
    `sender_relationship`, a sender address the description does not give,
    and a grant worded as a prohibition.
  - A rule may ask up to five yes/no questions, no longer three.
  - A rule request (`EmailRuleRequest`, and the `createEmailRuleRequest`
    answer) carries `share_terms`: for the member asked, while pending, what
    accepting would share. Whether it was accepted with changes is
    `edited_on_accept` on the share. `acceptEmailRuleRequest` answers with
    the rule and its share, and takes `expectation_samples`, made-up emails
    kept on the rule it writes.
  - `testEmailRule` takes `expect` and answers with `expectations`,
    `scope_warnings` and `summary`. Its results carry `values` and
    `question_answers_source`, and `testEmailRuleOnSample` answers with
    `values`.
  - `getEmailRuleScope` carries `scope_warnings` and `reads_nothing`.
  - `listEmailRuleResults`' `hidden` counts rules that decided on the email
    that you cannot see, and `not_listed` the rules you can see past the 50
    listed. A rule listed `read_only` (on the dashboard and in the CLI only)
    is another member's rule that decided on your own mail, with its
    `author`; its `name` is null unless it is known to cover you.
  - `listEmailRuleDecisions` carries each email's `from_address`, `subject`
    and `received_at`, and it and `listEmailRuleDecisionsOnMyMail` carry
    `recipient` and `decided_at`.
  - `listEmailRules` takes `all`, `author`, `mailbox`, `kind` and `state`;
    with `all`, each rule carries `receivers`.
  - `testEmailRule` answers `changes`: what the tree would newly match and
    stop matching against the rule's current version, or against a
    request's rule as asked (`compared_to`).
  - Judged expectations, made-up emails and look-alikes carry `close_call`,
    and the counts `close_calls`. Look-alikes carry `group` (`private`,
    `near_miss` or `must_match`) and their counts `by_group`;
    `generateLookAlikes` takes the `legal` and `personal_correspondence`
    kinds.
  - `testEmailRule` results carry `attachment_descriptions`, and rule
    questions read text from PDF and image attachments where attachment
    reading is active.
  - `listEmailRuleVersions` lists versions newest first with `limit` and
    `cursor`; `versions` is optional.
  - `listEmailRuleDecisions` and `listEmailRuleResults` carry
    `detail_withheld` on a decision whose email's content cannot be read;
    `testEmailRule` answers carry `questions.stored`.
  - `acceptEmailRuleRequest` needs `mail:share_own` (sharing your own mail
    through email rules), no longer `mail:send_as_member`. The Node
    `PERMISSIONS` list gains `mail:share_own`. `createRole` and
    `updateRole` refuse a permission whose prerequisite is not in the same
    role, with `400` and `details.reason` `unmet_requirement`.
  - New error code: `email_rule_request_not_deletable`, for deleting a
    rule request that is pending or accepted. `deleteEmailRuleRequest`
    deletes a withdrawn or declined one.
  - A rule share carries `rule_name`, kept after the share ends and after
    the rule is deleted, and `accept_changes` when the rule was edited on
    accept; the member it is shared with keeps seeing `granter.email`
    after it ends. A rule request carries `accepted_english`. A rule
    covering your mail names its author's `email`.
- Endpoints:
  - Webhook signing: a webhook made as a person's own, or by an API key
    limited to some mailboxes, a third-party app or an agent delegate for
    itself, signs with its own secret, not the organization's. Its
    `signed_with` is `own_secret`; verify its deliveries with the
    `signing_secret` returned when it is created, or from
    `getEndpointSigningSecret`. `signed_with` is `organization_secret` for
    a webhook verified with `GET /account/webhook-secret`.
  - Endpoints carry `signed_with` (`listEndpoints`, `getEndpoint`,
    `createEndpoint`, `updateEndpoint`), and `createEndpoint` and
    `updateEndpoint` answer with `signing_secret` when there is one to give.
  - `createEndpoint` and `updateEndpoint` take `Primitive-Step-Up`, and
    `updateEndpoint` takes `name`. `name` only needs at least one character.
  - Changing an endpoint's URL keeps the endpoint: its id, recipient routes,
    signing secret, delivery history and owed deliveries. A URL another
    endpoint has on the same domain is refused; see Endpoint answers under
    breaking changes.
  - `updateEndpoint` declares `403` and `503` answers; in Go they are typed
    responses instead of errors.
  - Endpoints carry `disabled_reason`: `owner_changed`,
    `owner_credential_revoked`, or null while on and when turned off by hand.
  - `listEndpoints` and `getEndpoint` carry `delivery` for a webhook: whether
    it is being sent received mail, every reason it is not, and, for a caller
    with access to every mailbox, `held_for_owner`, the rule-granted mail held
    while its owner cannot act.
  - `updateEndpoint` answers with `warnings` (`turned_off_owner_changed`,
    `turned_on_new_url`).
  - `testEndpoint` answers with `reachable` (whether the endpoint answered the
    test with a 2xx) and `delivery` (whether real `email.received` events
    would be sent to it, and every reason they would not).
  - `testEndpointRules` answers with `delivery` and declares `503`; in Go it
    is a typed response.
  - `createEndpoint` and `updateEndpoint` take custom request `headers`,
    which endpoint reads list with values redacted, and their `warnings`
    can carry `url_requires_login`, `url_redirects` (with `status`),
    `url_unreachable` and `url_not_checked` from a test request to a new
    URL.
- Credentials: `getCredentialPolicy`, `updateCredentialPolicy` and
  `getKeyBuilder`'s `policy` carry `cli_writes_require_approval`; `getKey`
  and `listKeys` items carry `status`; `revokeCredential` takes
  `Primitive-Step-Up`.
  - `listKeys` takes `include_revoked`, a string enum (`"true"` or
    `"false"`: `ListKeysIncludeRevoked.TRUE` in Python,
    `api.ListKeysIncludeRevokedTrue` in Go). `getKey` answers a revoked key
    too. A key's `status` can be `revoked`, with `revoked_at` and
    `revoked_by`.
  - A key read's `grant` carries `ref`, to send as `expected_grant_ref` on
    `updateKey`, and `resources`, the Functions, domains, endpoints or routes
    the key is limited to. `updateKey` answers `grant_unguarded: true` when a
    grant change was sent without `expected_grant_ref`. A grant change on a
    key with `resources` drops them only on purpose, with a custom grant and
    `grant.resources: {}`; one that leaves them out is refused with `409` and
    `details.reason` `key_has_resource_limits`.
  - `revokeCredential` answers `already_revoked: true` for an API key that
    was already revoked; `revoked` then counts only the keys it replaced
    that this call revoked.
  - `listKeys` items and `getKey` carry `rotated_from` and `rotated_to`: the
    key this one was rotated from, and the newest key rotated from it, among
    those the caller may read.
  - `revokeCredential` declares `standing_objects` (`kind`, `id`, `label`,
    `org_owned`): what the credential set up or owns and, for an API key,
    what it carries on for the keys it was rotated from. A webhook's `label`
    shows its URL's scheme and host, with the path and query hidden. What the
    organization owns keeps working; anything else keeps working only while
    someone can still act for it, such as a key of the same rotation that
    still works. It also declares `keep_failed`, the items chosen to keep that
    could not be taken over.
  - For an API key, each of `revokeCredential`'s `standing_objects`
    carries `still_acting` (whether anything still acts for it) and, for a
    webhook, `delivering`, each null when it could not be read, and
    `acting_key_id`, the key that still acts for it, to a caller who may
    read the organization's API keys. Revoking an API key also revokes the
    keys it replaced in its rotation that are still in their overlap and
    that you may revoke, and revoking a key already revoked does the same:
    the answer carries `predecessors_revoked_count` and
    `predecessors_revoked`, and `predecessors_left` and
    `predecessors_not_revoked` for the ones left working until their overlap
    ends.
  - The person who holds an API key may suspend it with `updateKey`, and
    revoke it with `revokeCredential` or in `decideSuspension`, whatever it
    reaches, as themself rather than through another app.
- `getDelivery` carries `attempts`; it and `listDeliveries` carry
  `latest_attempt`, `next_attempt_at`, `response_status`,
  `response_body` and `rules`, the rules the attempt's payload named.
- `ErrorResponse.error.details` declares `feature`, `feature_name`,
  `enabled_by` and `contact_email`, which a `feature_disabled` error
  carries.
- `decideSuspension` declares `502` and `503`; in Go they are typed
  responses.
- In Go, an optional field with a fixed value (such as `detail_withheld`
  on a decision about your own mail) is encoded only when it is set, so
  re-encoding a decoded response no longer adds it.
- New error code: `key_revoked`, a `401` for a full API key that was revoked.
  The CLI prints its message without the sign-in hint, `listen` stops and
  says to connect the agent again, and the default From lookup of `send`
  and `chat` treats it as a refused credential.
- A rule question's answer in `testEmailRule` (its results and sample
  judgments), `testEmailRuleOnSample`, `generateLookAlikes` and
  `listEmailRuleResults` carries `confidence`, how sure the answer is from
  0 to 1, null when unanswered. The `question_answers` descriptions of
  `listEmailRuleDecisions` and `listEmailRuleDecisionsOnMyMail` name the
  fields each answer carries.
- A rule share (`getEmailRuleShare`, `listEmailRuleShares`,
  `listGivenEmailRuleShares` and the `share` of `acceptEmailRuleRequest`)
  declares `activity` for the member it is shared with: `last_decided_at`,
  when its rule last looked at an email in the granter's mailboxes. Its
  `rule_id` description says where that member uses the share
  instead.
- `listActivityObjects` with `relation=concerning` declares the `stopped`
  coverage notice and its `stop_reason` (`deleted`, `turned_off` or
  `no_longer_covers`), and the `activated` notice, for a rule you were
  told of in observe that is now active. It lists deleted email rules.
- The `domain_ids` filter of `listEmails`, `searchEmails` and
  `semanticSearch` matches a domain by name within the organization.
- The `rules` of a key's grant (`createKey`, `updateKey`,
  `decideSuspension`) say which addresses beside them are refused, with
  `details.reason` `rules_beside_domain` or
  `rules_beside_personal_mailbox`, and the `last_error` of `listDeliveries`
  and `getDelivery` says how much of a webhook's answer it quotes.
- In Python, the question answer models of the rule test, sample
  judgment, look-alike and rule result answers above take `confidence`
  before `error_class`, as the served document declares it: pass
  `error_class` by keyword.
- Also optional, so the clients read an answer that leaves them out:
  - `testEmailRule` results carry `attachment_names` on matched emails and
    near misses: the file names the email lists, at most 10.
  - A scope warning's `name` is at most 320 characters and its `message`
    1000.
  - `updateEmailRule` also answers `affects` when a write turns a grant
    rule active.
  - `listEmailRulesCoveringMe` items carry `english` and `explanation`, of
    the rule's current version.
- New error code: `sending_ip_warmup_cap`. A held scheduled send's `hold`
  `reason` can also be `sending_ip_warmup_cap`.
- `pullWebhookEvent`'s `503` is also `service_unavailable` when the
  subscription was too busy to claim from in time: nothing was claimed, so
  retry after `Retry-After`.
- Email rules:
  - `testEmailRule` can answer an email `skipped`, with `skipped_reason`
    (`not_relay_domain`, `unparsed`, `rejected` or `content_discarded`),
    and its `counts` carry `skipped`. A skipped expectation is undecided.
  - In the `expectations_check` of `createEmailRule` and `updateEmailRule`,
    `passed` says whether every expectation passed, beside the `failed` and
    `undecided` emails and made-up emails.
  - Every rule answer carries `kind` (`grant` or `do_not_share`).
  - `createEmailRuleRequest` and `checkEmailRuleRequestTarget` take a
    member's verified work email in `target_email`, for a caller who can
    list members.
  - `listEmailRuleShareEmails` no longer answers `409` for a share whose
    rule is off.
  - `listEmailRuleDecisions` and `listEmailRuleResults` carry `withheld_by`
    (`EmailRuleWithheldBy`: the do-not-share rules you can see that kept a
    match from being shared, and why) and `withheld_by_hidden` (how many more
    kept it back that you cannot see, or that were deleted since).
  - `testEmailRule` results carry `recipient`, the mailbox the email was
    received in.
  - Each rule's decision in `listEmailRuleResults` carries `near_miss`.
- `listEmails`' `recipient` filter only filters the mail the caller can read
  and is never refused for that: a mailbox outside the caller's mail access
  lists nothing. For a credential limited to some mailboxes,
  `meta.recipient_outside_access` or `meta.recipient_rules_only` says when
  the mailbox is neither one of its addresses nor on one of its domains.
- Routes: `createRoute` and `updateRoute` answer with `warnings`
  (`endpoint_owner_limited`, `route_owner_limited`, `owner_unchecked`) and
  refuse a route that could never deliver with `400` `validation_error`,
  `details.reason` `endpoint_owner_access` or `route_owner_access`.
- `getDelivery`: each of its `attempts` carries `response_status` and
  `response_body`, the endpoint's answer to that attempt.
- `listOrganizationPeople`: each person carries `mail_access` (`read`,
  `send`), what their access lets them do with mail now.
- `listMailboxAccess` carries `note` when there are no entries, saying where
  each member's mail access comes from instead.
- `listRoles` carries `unassigned`, what a member with no role of their own
  holds.
- `whoami` carries `email` (your own sign-in email) and `role_name` (your
  role as the members list labels it). Both are set only when you are signed
  in as yourself, and null for API keys, Functions, connected agents, agent
  signup logins and other apps.
- `listDeliveries` and `getDelivery`, and each of `getDelivery`'s
  `attempts`, carry `retry_scheduled`: true when the email has another
  automatic delivery pass to come, false when no automatic retry will try it
  again, and null while a delivery pass for the email is running now. A
  rule-granted delivery, retried on a schedule of its own, reports it on its
  latest attempt: true while another attempt is to come, with
  `next_attempt_at` saying when (at the first retry pass at or after it);
  null while an attempt is under way, while it waits on an owner who cannot
  receive mail or on a held endpoint, past its 7-day limit, or when that
  could not be read; and false otherwise. It is null on every attempt of a
  held delivery, a pull attempt, and a sent email's or other event's
  delivery. Null is not false: in Go it is a `NilBool` and in Python
  `bool | None`. `next_attempt_at` is null on every delivery that is not
  rule-granted.

#### Node SDK

- `InboundEmail`, returned by `client.inbox.stream()` and
  `client.inbox.waitForNext()`, extends the generated `EmailSummary` and
  carries the whole row the API sent, including `snippet`, `copies`,
  `sent_email_id` and `from_header_email`. The camelCase fields are
  unchanged.

#### Go SDK

- The README documents that the generated decoder skips response fields the
  generated types do not declare. Reading a field the API added later needs a
  release generated from a spec that declares it.

#### Signing in as yourself, organizations and grants

- `primitive login` with no email asks for a login as the person
  (`login_kind: "user"`). A server that refuses the field gets the
  organization-bound login instead.
- `primitive org list` lists your organizations and whether the CLI may be used
  there. `primitive org use <org>` switches, and `--org <org>` (or
  `PRIMITIVE_CLI_ORG`) applies to one command.
- `primitive login --permission <permission>` asks for a narrowed login. A
  server that does not offer one refuses it, and the login is never widened.
- `primitive whoami` shows the organization, role and grant where the server
  reports them. `primitive whoami --check <permission>` asks whether the
  credential may use a permission, and `--json --grant` adds the grant.
- A credential that cannot read the account no longer fails `primitive
  whoami`: it reports its own grant from `GET /whoami/grant`. `primitive
  doctor` warns instead of reporting a rejected key, and `primitive login`
  treats that session as a valid login.
- `primitive send` without `--from` uses the single address a narrowed grant
  names when the credential cannot list domains. Session enrollment no longer
  needs `domains:read`.
- `primitive roles list|groups|mailbox-access|access-mode` are read-only
  views.
- A `403 grant_forbidden` names the missing permission. The CLI prints a hint,
  and the Node, Python and Go SDKs raise a `GrantForbiddenError` that is still
  their ordinary API error type.
- Node SDK: `client.keys`, `client.credentials`, `client.roles`,
  `client.account.whoami({ grant: true })`,
  `client.account.checkPermission(...)`, `GrantSpec`, `PERMISSIONS`,
  `OPERATION_PERMISSIONS` and `BUILTIN_ROLE_KEYS`.

Saved login format: a login as the person is stored in `credentials.json` with
`auth_method: "user_grant"` and a `user_grant` object holding the identity
token and the per-organization tokens. Logins saved with `auth_method:
"oauth"` keep working unchanged.

Downgrading: CLI 1.75.0 and earlier cannot read a `user_grant` login. Every
command fails with `Stored Primitive CLI credentials are malformed: auth_method
must be oauth`. `primitive logout` on the older CLI removes the local file and
does not revoke the login on the server, so log out with this CLI before
downgrading, or sign in again afterwards.

- Python and Go SDKs: the built-in role keys, as `BuiltinRoleKey` in both.

#### API keys from the CLI

- A person signed in with `primitive login` can manage API keys from the CLI:
  `primitive keys create`, `rotate`, `update` and `revoke`, alongside `keys
  list` and the new `keys get`. Listing and showing a key never print a
  secret.
- Creating, rotating and changing a key run directly from the person's own
  login. If the organization requires approval, the command prints the
  approval link, opens it where it can, and waits for the one-time token the
  page shows. In a script it prints the link and exits: approve, then run
  it again with `--step-up-token`.
- A key never holds more than the person's own access, and the
  organization's credential policy applies. `keys create` has no default
  grant: it needs `--preset`, or `--permission` with the mail the key
  reaches (addresses, domains, email rules, or every mailbox).
- The new secret is printed once, alone on stdout or in the JSON, and the CLI
  never saves it. `keys revoke` asks for confirmation unless `--yes` is
  passed.
- `keys update` changes a key's permissions or rules only when the key read
  shows its resource limits and it has none; a key with limits is not
  changed. It sends the read's `grant.ref` as `expected_grant_ref`, so the
  change is refused if the grant changed after the read. If the server's key
  read does not show resource limits, a grant change is refused and nothing
  is sent.
- `keys update` takes `--add-rule` and `--remove-rule`, which add email rules
  to a key or take them off and keep its other rules. `--rule` still replaces
  every rule the key has, says so in its help, and cannot be combined with
  them. The output lists any rules a change took off (`rules_removed` with
  `--json`) and any asked to be taken off that the key did not have
  (`rules_not_on_key`); a change that leaves the grant as it is sends no
  grant change, and nothing at all unless `--name`, `--expires-at` or
  `--no-expiry` is also given.
  The help of `--rule` starts with "Replaces the key's rules", so the
  compact `--help` shows it.
- When the API refuses a permission with `<name> cannot be granted to a
  key`, `keys create` and `keys update` add a hint (in `warnings` with
  `--json`) that says whether the name is not a permission at all or is one
  an API key cannot hold, asked of `GET /whoami?check`, then lists the
  permissions a key can hold as this CLI version lists them. An update
  refused over a permission the key already holds says to take it off with
  `--remove`. `keys create --help-full` lists the permissions by area.
- `keys revoke` says how many keys it replaced were revoked with it (those
  still in their rotation overlap) and how many were left working because
  you may not revoke them, naming them when you may read the organization's
  keys. It lists what the key set up, owns or carried on for the keys it
  replaced, each with whether the organization owns it, whether anything
  still acts for it (and which key, when you may read the organization's
  keys), and, for a webhook, whether it still delivers received mail. A
  webhook's URL is shown without its query. It lists ten and counts the
  rest; `--json` has them all. Revoking a key already revoked no longer
  says nothing changed when it revoked keys the key had replaced.
- `keys list --include-revoked` lists revoked keys too, each marked
  `[revoked]` with when it was revoked (with `--json`, `status`,
  `revoked_at` and `revoked_by`), so a revocation can be confirmed without
  keeping the key ids beforehand. Without it, an empty list says revoked
  keys are left out.
- `keys get` on a revoked key prints when it was revoked, and by whom when
  the read says. `keys update` refuses to change a revoked key's grant before
  asking for any approval, and `keys revoke` on a key that is already revoked
  says nothing changed.
- A rule a key lists that reads nothing any more (a deleted rule, or a share
  that ended) is shown under `grant.mail_scope.ended_rules`. `keys update
  --remove-rule` takes such a rule off, and any other change to the key's
  grant leaves it off too and lists it under the rules taken off. `keys get`
  and `keys list` show them with their reason, and `--add-rule` or `--rule`
  refuse to put one back.
- `keys update` changes the grant of a key whose read shows
  `grant.mail_scope.rule_versions`, which it never sends back. A mail scope
  setting it cannot restate is named in the refusal.
- A key that lists an address or domain beside its email rules reads every
  email there, not only the rules' emails (the `whole_mailbox` note in
  `address_warnings`), which `keys create`, `keys update`, `keys get` and
  `keys list` print as the API wrote it. `keys update` refuses a rule added
  to a key that lists a domain, with exit code 2 and no change sent; the API
  says which addresses and domains it refuses beside a rule.

#### Rule request and objection webhook events

- The catalogs list `email_rule_request.created`, `accepted`, `declined` and
  `withdrawn` (`EMAIL_RULE_REQUEST_EVENT_TYPES` in Node and Python,
  `EmailRuleRequestEventTypes` in Go). The Node SDK also has the body's shape
  (`EmailRuleRequestEvent`) and a type guard (`isEmailRuleRequestEvent`). Each goes to the person who did not act, only
  to a webhook that person made for them, and only when the webhook lists
  them. The body always carries the asker's `message` and a decline's
  `decline_reason` (null when there is none), and `type` but not `event`, so
  parse it with the `X-Webhook-Event` header.
- A webhook for these events is an http webhook its owner made, signed in as
  themself; one made with an API key, another app or an agent is refused. An
  existing webhook of their own can be given them by an update that restates
  its `url`. It is its maker's own whatever their access: only they can change
  it, and it cannot be given to an API key. It is always a route target, so it
  receives mail only through routes; asking for it to be a default
  (`is_route_target: false`, or a takeover) is refused.
- `--event-types 'email_rule_request.*'` names the whole family, which the
  API expands to the four events, as it does `sent_email.*`.
- The catalogs also list the rule objection events,
  `email_rule_objection.created`, `accepted`, `declined`, `amended` and
  `withdrawn` (`EMAIL_RULE_OBJECTION_EVENT_TYPES` in Node and Python,
  `EmailRuleObjectionEventTypes` in Go): `created` and `withdrawn` go to the
  rule's author, `accepted`, `declined` and `amended` to the member who
  objected. The body names the objection and its rule, its `status` and a
  decline's `decline_reason`, on `amended` the `amended_version` and
  `amend_note`, and on `created` and `withdrawn` the `objector`; never the
  objector's message.
- The catalogs list the coverage events, `email_rule_coverage.started`,
  `new_version` and `stopped`, sent to a member's own webhook when another
  member's rule starts covering their mail, saves a new version while
  covering it, or stops (with `stop_reason`); the Node SDK has
  `EmailRuleCoverageEvent` and `isEmailRuleCoverageEvent`. They also list
  the `credential.*` events.
- The Node SDK has its shape (`EmailRuleObjectionEvent`) and a type guard
  (`isEmailRuleObjectionEvent`). The objection events are opt-in and kept to
  a webhook its person made for them, as the rule request events are.

#### Values the API adds later

The generated Python and Go clients now keep an enum value they do not know
instead of failing to decode the response, as the Node types already did. An
unlisted `error.code` or email rule `state` decodes normally: in Python it is
a member of the enum type holding that string, and in Go the typed string
holds it. The published `primitive-api.yaml` also parses under YAML 1.1
parsers.

#### Email understanding

- For organizations with email rules enabled, `email.received` events carry
  `email.analysis.understanding` (`EmailUnderstanding`): a `version`, a
  `status`, and when `ready`, `facts` keyed by name with a value and a
  confidence. Rule-granted deliveries also list the matching `rules`. The
  webhook schemas, the Node, Python and Go types and the shared fixtures cover
  the field.
- `matchedRules(email, ruleId?)` in Node, `matched_rules(email, rule_id=None)`
  in Python and `EmailAnalysis.MatchedRules()` in Go return the rules that
  granted a delivery, typed, from either the received email or the event.
  They return nothing when no rule granted the delivery and skip entries
  without a rule id. Given a rule id (`MatchedRulesFor(ruleID)` in Go) they
  keep only that rule's entries. Node's returns nothing, rather than
  throwing, for a missing or non-object argument too, and Python's for
  `None`. Node also exports the helper and the understanding types from
  `@primitivedotdev/sdk/api`.

#### CLI

- `test-email-rule` prints what the tree would change against the rule's
  current version or a request's rule as asked, and marks close calls;
  the look-alikes report prints counts by group.
- `list-email-rules` takes `--all`, `--author`, `--mailbox`, `--kind` and
  `--state` and prints a table; the decision listings print a table.
- `endpoints create` and `update` take a repeatable `--header 'Name:
  value'`, `update` takes `--clear-headers`, and both print the answer's
  warnings.
- An unknown command suggests nearby commands in
  `error.details.suggestions`.
- Help groups flags as required inputs, command options and common
  flags.
- For a request field marked `x-primitive-retry-id`, a generated command
  creates and prints a retry ID when the flag is left out, and lists it in
  `cli_retry_ids` under `--json`.
- `primitive focus set <domain...>`, `focus set --all`, `focus` and `focus
  clear` choose, show and clear the domains a profile lists and searches.
  The focus is saved per profile and organization, never in a credential
  file; `PRIMITIVE_FOCUS_DOMAINS` overrides it for a session and
  `--domain` or `--all-domains` for one command. A focused command names
  its focus on stderr, or in `meta.focus` under `--json`. Reads by id,
  notifications and reply bookkeeping never follow it.
- `endpoints get`, `list`, `create` and `update` print webhook URLs as
  stored again, in every output mode.
- `primitive send` and `primitive reply` take `--text` as another name for
  `--body`, the plain-text body.
- Without `--json`, `endpoints list` prints a table on stderr after the JSON
  with each endpoint's ENABLED and DELIVERING. DELIVERING is read from
  `delivery.delivering`, not from `enabled`, so an enabled webhook that is
  sent nothing (its owner's key revoked, say) reads `no`, with the reason
  codes in parentheses. A Function or pull endpoint shows `-`, and a webhook
  whose delivery could not be checked shows `unknown`. `--json` output is
  unchanged.
- `primitive activity created`, `asked` and `concerning` retry a rate
  limit, an unavailable API (502, 503 or 504) or a network error with
  backoff, up to four tries within about 15 seconds, saying so on stderr,
  as the CLI's waits do. A `Retry-After` longer than that is not waited
  out. When Primitive cannot be reached the error is `network_error`,
  reading "Could not reach Primitive (network error). Try again in a
  moment.", with the transport's code as `cause`, the same with and without
  `--json`. An error answer with no code of its own (an empty body) is
  named by its HTTP status, and one whose body cannot be read is
  `response_error`. A host name that does not resolve (`ENOTFOUND`) gets a
  hint wherever the CLI prints a network error's hints.
- `primitive machine doctor` compares a preview build of the CLI with npm's
  `preview` dist-tag, whole version and all, and warns when a newer preview
  is out (`npm install -g primitive@preview`) or when the release it
  previews is out (`primitive@latest`). Before, a preview was compared
  with the latest release alone, ignoring its prerelease part, so it read
  as current. `--min-cli-version` compares a preview build whole too, so
  `3.0.0-preview.13` no longer meets `--min-cli-version 3.0.0`.
- `email-rule-oversight create-email-rule-objection --help` says the
  message can ask the rule's author to narrow the rule or explain where its
  matches go, and that the author accepts (turning the rule off),
  declines, optionally with a reason the objector sees, or answers amended
  once they have saved a new version of the rule, optionally with a note.
  `decline-email-rule-objection --help` says the reason can explain a
  receiver, and that an author who changed the rule answers with
  `amend-email-rule-objection` after saving the new version.
- `primitive version` prints the line `primitive --version` prints (the
  CLI's name and version, platform and architecture, and Node version).
  With `--json` it prints `version`, `platform`, `arch` and `node` (Node's
  version without its leading `v`). It needs no login and does not call
  the API, and it is listed in the root help.
- An unknown command suggests a command of the same name in another group:
  `primitive email-rules list-email-rule-objections` asks `Did you mean
  "primitive email-rule-oversight list-email-rule-objections"?` before
  pointing to `--help`. Only the word typed where a subcommand was
  expected is looked up (at the top level, the first two words), never a
  value after it; hidden commands are not suggested, and more than three
  matches give no suggestion.
- `email-rules create-email-rule`, `update-email-rule`, `test-email-rule`,
  `test-email-rule-on-sample`, `generate-look-alikes` and
  `compile-email-rule` take `--scope-address` and `--scope-domain`, so a selected scope no longer
  needs `--raw-body`: `--scope-address support@example.com --scope-domain
  example.org` sends `scope_selection` with both lists, and a list not
  given is sent empty. Repeat a flag or give a comma list. They set
  `scope_selection` over any in `--raw-body` or `--body-file`, and send
  `evaluation_scope` `selected` when neither `--evaluation-scope` nor the
  body gives a scope; a scope given otherwise is sent as it is.
- A generated command's boolean flag that has a `--no-` form also takes
  `true` or `false`, so `endpoints update <id> --enabled false` sends
  `enabled: false`. Before, the `false` was read as an argument, which the
  command refused or took for the endpoint id, and `--enabled=false` was
  read as `--enabled` followed by a `false` argument. The bare flag still
  means true, and `--no-enabled` still works. Another yes or no word after
  the flag (`yes`, `no`, `y`, `n`, `on`, `off`, `1`, `0`), and any value
  after `--no-enabled`, is refused with exit 2 rather than read as the id.
- A generated API command refuses (exit 2), sending nothing, a top-level
  text field longer than the API's `maxLength` for it, counted after
  trimming its ends. A text flag whose request field has such a limit, and
  whose description does not already give one, says "At most N
  characters." in its help; a field held to a pattern or format is left
  alone.
- The help of `--body-file` on `create-email-rule`, `update-email-rule`,
  `create-email-rule-request` and `accept-email-rule-request` says it takes
  the `rule` of a saved compile answer (`compile-email-rule ... --json | jq
  .data.rule > rule.json`), and which flags to add beside it.
  Short `--help` says under the summary when the full description says more
  (`--help-full`).
- Without `--json`, a generated command prints a note on stderr for each
  flag its answer's `meta` sets that changes how the data reads: `emails
  list --recipient` when the credential does not read that mailbox
  (`meta.recipient_outside_access`, so the list is empty; the note replaces
  the general empty-list hint) or reads it only through email rules
  (`meta.recipient_rules_only`), `emails search` when the page stopped at
  the search time limit (`meta.partial`), and `sending permissions` when the
  credential can only reply (`meta.replies_only`) or the address rules were
  cut short (`meta.truncated`). `--json` output is unchanged.
- Without `--json`, every single-object answer of an `email-rules` or
  `email-rule-oversight` command (a compile, a rule write, a rule or request
  read, an accept, a delete) is followed on stderr by one printer of the
  server's own words on it: each scope warning, each warning (the answer's,
  its summary's or its rule's) and its `note` and a rule's
  `protection_note`, each once, on one line, without terminal control
  sequences, and with the CLI command beside each API route they name.
  `create-email-rule --state active` can create a do-not-share rule
  already active; a grant rule is still refused.
- Without `--json`, `email-rules generate-look-alikes` prints each
  look-alike email, numbered from 1 as `--pick` takes it: its status, kind,
  subject and sender, why the rule should (or, for most, should not) match
  it and what the rule decided, then the counts and the server's notes. The
  answer saved with `--json` is a samples file, in the same order, each
  look-alike keeping its `expected`.
- `email-rules create-email-rule --expectation-samples-file` and
  `update-email-rule --expectation-samples-file` (replace; a file holding
  `[]` removes them) or `--add-expectation-samples-file` (add), not both,
  save made-up emails from such a file, or from a saved
  `generate-look-alikes` answer. `test-email-rule --expect-samples-file`
  sends them in `expect.samples`, beside any emails by id. `--pick 2,4`
  takes only those numbers and refuses one the file does not hold.
- `email-rules accept-email-rule-request --expectation-samples-file` (with
  `--pick`) keeps made-up emails from such a file on the rule the accept
  writes, such as a request's look-alikes, each keeping whether it must match;
  `generate-look-alikes --request-id` says so in its save hint.
- Without `--json`, `test-email-rule` names each made-up email that did not
  pass as `sample N`, its place from 1 among those judged, with its label.
  `test-email-rule` exits 1 when an expectation failed, or is undecided and
  the answer does not say testing again can decide it; 3 when every
  undecided one can be decided later (the answer's `retryable`); and 0
  otherwise. Under `--json` the document carries `error.code`
  `expectations_failed` or `expectations_undecided` and `exit_code`.
- Without `--json`, `email-rules test-email-rule` opens with the mail it
  tested ("Tested N emails received ... to ..."), from the answer's
  `window`, and lists the matched emails, at most 25, each with its
  sender, subject and, from `attachment_names`, its file names; a near
  miss gets the file names too. Each question's answer shows at its
  `confidence`, so a no reads "no at 0.80" rather than "no at 0.20".
- `email-rules test-email-rule --same-emails-as <file>` takes an answer
  saved with `--json` and tests the emails that answer tested, so two
  trees are tested over the same mail. A file with no results or no emails
  is refused (exit 2) and nothing is sent.
- `primitive keys create --rule` says in its help that a rule shared with
  you goes on a key by the share's id from your own dashboard session only,
  not through the CLI, and that your own webhooks receive what a share
  gives you without a key. `keys update --add-rule` says the same, and its
  help says a change to the permissions or rules of a key that lists a
  share made with you is made from the dashboard, unless it takes the
  share off.
- An empty `email-rules list-email-rule-requests`,
  `list-email-rule-shares` or `list-given-email-rule-shares`, or
  `email-rule-oversight list-email-rule-objections`, says what the list
  leaves out without its filters and how to widen it (`--box all`,
  `--status any`, `--live any`). An empty `webhook-deliveries
  list-deliveries` narrowed by a filter (such as `--endpoint-id` or
  `--status`) names the filters given and notes that test fires are not
  logged, instead of saying no deliveries were logged.
- `keys create` and `keys update` print the answer's `address_warnings`
  without `--json`, such as a member's own address, each once as the API
  wrote it.
- A rule write the API refuses (the expectations gate, a conflict) exits 1
  and prints the API's error as it is. `--if-revision` and
  `--restore-version` come from the spec. A judged write can take as long
  as a test of the rule.
- `send` and `chat` without `--from`, for a credential whose grant has no
  `mail:send`, say that it has no `mail:send` and what would give it the
  permission (for an API key, `keys update <key id> --add mail:send`), and
  exit 1 with `code` `grant_forbidden` and `details` `{ "permission":
  "mail:send", "reason": "permission_missing" }`, as the send itself refuses
  it. They do not ask for `--from`, which could not help. When `send`,
  `reply` or `chat` stops on an error of the CLI's own rather than an API
  answer, the `--json` envelope's `error` keeps that error's `code` and
  `details`. When `send` or `chat` has no From to default to, that code is
  `no_send_address` when the credential lists nothing it can send from,
  and `no_default_from` when `--from` is needed to choose.
- `primitive send`, `reply` and `chat` put the API's own message in the
  summary line of a send the API refused, right after the status, on one
  line and cut at 300 characters, and print that line before the error
  itself; `--json` carries the same text as `outcome_message`. With
  `--json`, a `send` or `reply` stopped before the request is made leads
  `outcome_message` with the reason too (`Message not sent: <reason>
  Nothing went out; ...`, or `Reply not sent: ...`).
- An empty `emails list` or `emails latest` says what the credential reads
  instead of "No inbound emails received yet on this account", which is true
  only for a credential that reads every mailbox: a key limited to email
  rules is told how its rules grant mail and who can check them, a narrowed
  credential is told which mailboxes it reads, and a filtered list, a page
  past the last and a caught-up `--since` tail say so, and an empty page that
  still has a next cursor says to continue with it. The credential's reach
  is read from `GET /whoami/grant` only when a hint is printed, and a
  connected agent's key is answered from its own address.
- `roles-and-members set-member-role` warns, before the change is sent and
  before any approval link, when the role reads all of the organization's
  mail while the organization uses whole-organization access (it holds
  `mail:read` over the whole organization). `organizations
  invite-organization-member` refused for Member, or for a role above it,
  says why: only an invitation sent from the dashboard can offer that role
  (and there every Member reads all of its mail), so from the CLI invite
  with `--role none` and give a role once they have joined.
- `primitive activity asked` lists what other members asked of you, newest
  first, open or answered: the rule requests made to you and the
  objections to rules you wrote, each with its kind, state, who asked or
  objected, and its id. It takes `--state`, `--limit`, `--cursor`,
  `--all` and `--json`. Its help points to `primitive activity created
  --kind email_rule_request,email_rule_objection` for the requests and
  objections you made. The `activity` topic names `activity asked`,
  `concerning` and `created`, and the `emails`
  topic and `emails list` point to `emails latest --limit 100` for one line
  per email.
- `primitive activity concerning` lists what other members' rules did to
  your own mail, newest first: each coverage notice (`started`,
  `activated`, `new_version`, `stopped` or `baseline`), when, the rule's
  name then and
  its author. A `stopped` notice, a rule that no longer covers you, shows
  why in a CHANGE column (rule deleted, set to draft, or no longer reaching
  your mailboxes), and a `baseline:` line explains a baseline notice.
  It takes `--limit`, `--cursor`, `--all` and `--json`. Its `RULE ID`
  column is each notice's `rule_id`, which `email-rule-oversight
  get-covering-me` and `create-objection --rule-id`
  take, and its help and empty listing say notices can lag and point to
  `list-covering-me` for what covers you now.
- When the API lists no address and no domain a credential can send from,
  send's error no longer suggests `--from`, which cannot help then.
- `primitive activity created` lists what you created, newest first, with
  where each object stands now. Signed in with `primitive login`, it covers
  what you created through any credential of yours, names the credential on
  each row, and includes your API keys, agents, email rules, rule requests
  and objections; with an API key or an agent's key, it lists what that key
  created. Kinds your access does not let you list are named at the end, with
  the permission that would show them. It takes `--kind`, `--state`,
  `--limit`, `--cursor`, `--all` and `--json`.
- `primitive billing` opens the dashboard's billing page, or prints its link.
- More commands take `--json`, which prints exactly one JSON document on
  stdout, failures included: `routes` (all of them), `org secrets`, `wake
  authorizations`, `wake dispatches` and `wake schedules`, `functions
  get-route`, `set-route`, `unset-route`, `routing-topology` and
  `set-secret`, `memories`, `describe` and `list-operations`. `functions
  logs` keeps `--jsonl`.
- `email-rules list-email-rule-results` takes the email's id as `--email-id`,
  since no other `email-rules` command's `--id` is an email id. `sending
  reply-to-email`, `sending signal-email` and `repeating-sends
  stop-repeat-from-email` take `--email-id` too. `--id` keeps working on all
  four.
- A list command whose data is an array and whose next cursor is
  `meta.cursor` says so in its help: `--limit` gives the page cap, and
  `--cursor` says the next cursor is printed on stderr as `next cursor:`
  without `--json`, and comes in `meta.cursor` with `--json`.
- `memories search` can page: it prints `next cursor:` on stderr when there
  is another page, and `--json` prints `meta.cursor` with the data.
- A generated command whose operation can ask for browser approval takes
  `--step-up-token` (the `Primitive-Step-Up` header; `--primitive-step-up`
  still works) and `--no-browser`. When the server asks for approval, it
  prints the approval link, opens it where it can, waits for the one-time
  token and sends the request again, as `primitive keys` does; under
  `--json` or without a terminal it prints the link and how to rerun.
  `endpoints create` and `endpoints update` take them as well.
- The help for `email-rules test-email-rule`, `create-email-rule` and
  `update-email-rule` says which writes the expectations gate judges and
  what a test's exit code means.
- `emails watch`, and `emails wait` when it waits for more than one email,
  now report an email that became readable after a later one was reported,
  as mail can when it is accepted more slowly, held while its sender is
  checked, or granted to a key by an email rule, if it becomes readable
  within ten minutes of arriving. While nothing new arrives they re-read
  recent mail, up to its 300 newest matching emails, at most every 15
  seconds (or every three poll intervals, when that is longer), so such an
  email prints after the later one. A wait or watch with a time limit can
  end before the next re-read, and a search by words that the server stops
  early for time may not reach as far back. A connected agent's
  `emails wait` reads its mail another way and is unchanged.
- `primitive wait` without `--include-existing` no longer returns the newest
  email already received as if it had just arrived. It started its tail
  from the newest email's `created_at`, but the tail orders mail by when it
  became visible, which is later, so it handed that email back at once. It
  now counts mail as new when it became visible after the command started:
  it reads what became visible since the start from the tail, then waits
  from the tail's own end. That also finds an email that was sent before the
  command started but accepted after it, and checks every email made
  visible since the start, where it checked only the newest 50. `inbox next
  --wait` starts from the tail's end too, and no longer wakes once for
  nothing.
- `emails wait --since` and `emails watch --since` also take a duration
  ago, such as `15m` or `2h`. `emails wait` says in its help, and in its
  timeout message, that without `--since` or `--include-existing` it counts
  only mail received after it started.
- A generated command with exactly one path parameter takes it as its first
  argument too, so `primitive emails get <id>` and `primitive email-rules
  get <id>` work; the flag (`--id`, `--email-id`) keeps working.
- A word after a command that takes no arguments is reported as an
  unexpected argument for that command, and a mistyped subcommand as an
  unknown command, instead of as an unknown command with the word joined
  into its name. Under `--json` the error is one JSON document on stdout.
- On a list that pages with `meta.cursor`, a `--limit` above the API's
  per-request cap (100 for `emails list`), up to 1000, is fetched in pages
  and printed as one list, with the last page's cursor in `meta.cursor`.
  With a long-poll `--wait` or a forward `--since`, which read one page,
  `--limit` stays at the cap.
- `primitive roles members` (also `primitive members list`) lists the
  organization's members with their roles, so you can see each member's
  role before asking someone, for example for an email rule. It takes `--query`,
  `--limit`, `--cursor` and `--json`.
- `primitive endpoints get <id>` reads one webhook endpoint, and
  `primitive email-rules vocabulary` prints the column catalog a hand-written
  rule tree is checked against. `email-rules delete-request`
  deletes a request you made that you withdrew or that was declined,
  `email-rules check-request-target` says whether a member can accept a request
  before you send it.
- `endpoints signing-secret <id>` (`get-endpoint-signing-secret`) prints the
  secret a webhook whose `signed_with` is `own_secret` signs with, and
  `endpoints rotate-signing-secret <id>` (`rotate-endpoint-signing-secret`)
  replaces it, or gives a webhook signed with the organization's secret one of
  its own, and prints the new secret.
- `email-rules list-email-rule-versions` lists a rule's versions newest first
  without `--versions`, and pages with `--limit` and `--cursor`.
- The email rule list commands fetch a `--limit` above 100 in pages, and
  their `--cursor` help names `meta.cursor`, now that their answers declare
  it.
- `keys update --json` prints the key at the top level, in the shape
  `keys get` and `keys create` print, with `changed`, `warnings` and
  `address_warnings` alongside, instead of nesting it under `key`.
- `keys update --expires-at <time>` gives a key a new expiry, which is how
  to keep a key working past its expiry: a later time extends it, within
  the organization's credential policy. `--no-expiry` removes it where the
  policy allows. `keys rotate` takes the same two flags for the new key.
  Without them the new key keeps the old key's expiry, and the command now
  prints when the new key expires. The time is ISO 8601 with its time zone.
- `keys revoke` counts separately what the organization owns, which keeps
  working, and what the key owned itself or carried on for the keys it was
  rotated from, such as its own webhooks, which keeps working only while
  someone can still act for it, such as a key of the same rotation that still
  works. Its help no longer says that everything the key set up keeps
  working.
- Generated commands the API answers only in a dashboard session, such as
  `credentials list-credentials` and `credentials list-credential-events`,
  say so: their summary, which short help prints, ends with `(dashboard
  only: the API refuses the CLI here; use the dashboard)`, and their full
  help starts with a note. The operation manifest (`primitive list-operations`, and
  `operationManifest` from `@primitivedotdev/sdk/openapi`) carries each
  operation's `access`, from the spec's `x-primitive-person-only`, or null;
  code that builds manifest objects by hand must now set it.
- Without `--json`, the CLI reads out a few answers people otherwise dig out
  of the JSON, on stderr after it:
  - `routes create`, `routes update`, `routes create-route` and
    `routes update-route` print each of the route's `warnings`.
  - `webhook-deliveries get-delivery` lists each attempt with when it was
    made, its status and error code, and what the endpoint answered: the
    HTTP status and the start of its body (terminal controls removed), or
    that no answer was recorded.
- `members list` (`roles members`) shows what each member's access lets them
  do with mail (`mail_access`: read and send, read only, send only or none),
  where you can see it.
- When a server message names an API route, such as "see GET
  /v1/email-rule-scope-options", the CLI names the command that calls it:
  after an error, as a `Hint: in the CLI, ... is ...` line, and inline in
  the email rule scope warnings it prints. Where a hand-rolled command covers
  the route, such as `keys create` for `POST /v1/keys`, that command is named.
- `keys revoke` takes `--step-up-token` and `--no-browser`. When the
  server asks for approval, it prints the approval link, opens it where it
  can and waits for the one-time token, as the other `keys` commands do.
- `email-rules test-email-rule` takes `--expect-match` and `--expect-no-match`,
  each repeatable and taking a comma list of email ids, or `--expect-file`
  with a JSON `expect` object. They set the request's `expect`, over any in
  `--body-file` or `--raw-body`. The exit code follows the expectations the
  answer judged: `expect`, or when none is sent, a saved rule's saved
  expectations. It is 1 when one failed, or when one is undecided and the
  answer does not say testing again can decide it, and 3 when every
  undecided one can be decided later (each undecided entry's `retryable`).
  Without `--json` it prints a report on stderr after the JSON: the
  server's notes, how each condition held and failed, the expectations with
  each undecided one's `reason`, and for each email that did not match the
  values its conditions compared. Under `--json` the report is left out, and
  when the exit code is not 0 the document carries `exit_code` and an
  `error` whose `code` is `expectations_failed` or `expectations_undecided`.
  Exit 1 also means the request failed, with the API's own error code;
  `--json` tells the two apart.
- `email-rules create-email-rule` and `update-email-rule` take
  `--expectations-file`, a JSON file with the emails the rule must match and
  must not; on update, a file holding `null` removes them.
- `test-email-rule` says how many decided emails the conditions held on
  together (`summary.conditions_held`).
- Samples files (`--expectation-samples-file`, `--add-expectation-samples-file`,
  `--expect-samples-file`) take `attachment_names`, as look-alikes now carry
  them; the API checks each sample.
- `domains zone-file` takes `--inbound-only`, the MX and ownership TXT
  records only, not with `--outbound-only`; `--outbound-only`'s help no
  longer says verified domains default to it. Without either, the file has
  every record.
- `keys update --json` carries the answer's `rules_added`.
- `primitive emails facts <id>` prints what the classifier read from a
  received email, one fact per line with its value and confidence. With
  `--json` it prints the `classification` object, or null when the email has
  none. An API key, agent key or narrowed token, which cannot read rule
  results, gets the facts from the email itself (`understanding.facts` of
  `emails get`) in the same shape, as the classifier wrote them, with a note
  saying so on stderr (in `warnings` with `--json`), instead of the rule
  routes' refusal.
- Generated commands for the new operations, except `createKey`, `rotateKey`,
  `updateKey` and `revokeCredential`, which the `primitive keys` commands
  cover instead, and `importGoogleMailMessage`, which takes a credential
  header.
- The generated command for `leaveOrganization` is
  `roles-and-members leave`, following the operation's tag.
- Flags for the new parameters, for example `primitive emails list
  --thread-id --exclude-muted --search-regex --search-case-sensitive
  --search-negate --kind --content-discarded --group --include-presence`,
  `primitive emails conversation --around --before --after --limit
  --text`, `primitive threads get --after`, `primitive
  sending list --since --wait`, `primitive
  agent-connections list --include-hidden` and `primitive
  account whoami --include --check --resource`.
- `primitive domains verify` reads a failed DNS check from the
  `dns_verification_failed` error and names the records that still need
  work.
- The event listener stops with an explanation when an event's content is
  withheld from the credential, instead of passing on an event it cannot
  show.
- A background listener start no longer stops a supervisor that is running
  and holds the receiver. When the new worker exits just after it reports
  ready, the start succeeds and the supervisor restarts the worker. Before,
  the start stopped that supervisor and left the receiver stopped, which
  could happen to a worker replacing its lost supervisor. When the startup
  timeout passes while the supervisor still holds the receiver, `listen
  --background` exits with an error that says the supervisor keeps the
  receiver, restarting it if it exits, and leaves it running. A start is still stopped
  when its supervisor exits, cannot be started or no longer holds the
  receiver, or when its worker reports a failure.
- A background listener whose session, profile or config directory differs
  from what the command that started it selected reports
  `connection-changed`, so its supervisor holds it as failed instead of
  restarting it. Other options are not treated this way.
- When a background start gives up, including one with no terminal to report
  to, such as a worker replacing its lost supervisor, its time, reason and
  failure code are saved. `listen --status` shows them as
  `listener.lastStartFailure` and in `listener.detail` until the receiver is
  receiving, `agent connect --status` does the same under `receiving`, and
  `primitive doctor` adds a Receiver warning for a connected profile while
  they are shown. A later start that succeeds, or the receiver starting to
  receive, removes the record.
- A background listener keeps receiving when the CLI is upgraded in place
  while it runs. Its supervisor restarts the worker on the new version.
  Before, the CLI version was part of the options the worker checks, so
  every restarted worker refused to start and the supervisor kept restarting
  it. Running the same `listen --background` command after an upgrade reuses
  a receiver started by this version or later. A start that changes
  contacts, contact requests, senders, events or the session socket while a
  receiver runs is still refused.
- A `listen --background` start refused because a listener already runs with
  other options now says why: that listener was started by an older version
  of the CLI or with different receiving options. It names the
  `listen --notify-session <session> --stop` command to run first, with
  `--api-key` or `--api-base-url` when the start gave them (never their
  values), and then the same command again.
- A listener started by an earlier release is handed to a supervisor of the
  new version when its worker next restarts. If that attempt does not
  complete, a later restart tries again after at least a minute. Until the
  handover, the same `listen --background` command is refused with that
  message, and `agent connect` reports the receiver as not ready.
  During it, `listen --status` shows `reconnecting` with `crashed` for a
  moment, then `stopped` for about a second, then the new supervisor starting
  and receiving. A handover, like a worker replacing its lost supervisor,
  starts nothing once the owner has stopped the listener with
  `listen --stop`, or while it is held as failed. After a downgrade to a
  release from before this change, stop the listener and start it again.
- A background listener's supervisor holds the receiver when a worker from a
  newer CLI reports a failure code this version does not know, instead of
  restarting it. Status from this version shows `unrecognized`; the newer CLI
  reads its own code back, so it can restart the receiver when that code
  allows.
- Unless stdin and stderr are both terminals, the email-code commands no longer
  wait on a prompt nobody can answer (before, Node exited with an unsettled
  top-level await). `primitive login <email>`, `signin <email>`, `login otp`,
  `signin otp`, `otp` and `signup` exit 2 before doing anything when
  `--accept-terms` is missing, and `login otp`, `signin otp`, `otp` and
  `signup` exit 2 when the email address is missing. The message names the
  command to run. `primitive signup interactive` always refuses without a
  terminal and names `primitive signup <email> --accept-terms` instead. What
  this changes for scripts is under Breaking changes.
- `login --accept-terms` without an email, and `login <email> --permission`,
  are usage errors and exit 2 (and the same for `signin`).
- When email-code login, sign-in or `otp` is refused because the address is
  on a domain Primitive receives mail for, the CLI says no emailed code is
  sent there and gives the browser login to use (`primitive login browser`,
  or `signin browser`, with `--no-browser` when there is no terminal). It
  exits 1 with the code `managed_domain`. `primitive signup` still prints the
  server's refusal.
- `primitive login --help` and `signin --help` no longer say they are only
  for existing accounts: an emailed code logs in to the account that uses
  the address, or creates a new account when none does.
- `primitive whoami` no longer prints the account's email as "Authenticated
  as". That email is the one the account was opened with, not necessarily
  yours, so a member who can read it was shown as someone else. The first
  line now names your member address. Without one it says that you have
  none (and gives the command that sets one when the server suggests an
  address), that an API key has none, or, for any other credential, that it
  has none. When the server says nothing about an address, the line is a
  plain "Authenticated". The account's email appears as "Account email"
  when you may see it. Bare `primitive` prints "Signed in as" your member
  address, or "Signed in" with the organization, from `GET /whoami`.
  `doctor`'s API auth check
  now starts its message with "account email". `whoami --json` is
  unchanged.
- The role lines say what they report. Where the server reports a grant,
  `whoami` prints `Built-in role:` for a person's login: the built-in role
  a request runs as, which for a template or custom role is the largest
  built-in role it fully includes, or member when it includes none. It
  prints no role line for an API key or any other credential that is not a
  person's login, and a role value that is not a built-in role prints as
  `Role key:`. `login`, `org use` and `org list` print
  the stored role as `built-in role owner`, `built-in role admin` or
  `built-in role member`, the name `whoami` uses, and say that for a
  `restricted` role `built-in role member` means a template or custom
  role that does not fully include member, because it lacks some member
  permission (as Operator does) or reaches only some mailboxes (and, in
  `org list`, no role at all), and does not grant member permissions.
  `roles groups` labels a group's role as `role id`, and `roles list` help
  names Operator as a template, not a built-in role.
- `primitive agent upgrade` needs a terminal: without one it exits 2 before
  sending anything and names `agent claim` and `agent claim-verify`
  instead. Before, it could email a code and then wait on a prompt nobody
  could answer. `--code` is refused, since the command's own email replaces
  that code, and at a terminal a blank `--email` is now asked for instead of
  being sent.
- `primitive org leave` without a terminal and without `--yes` exits 2 (it
  exited 1), before reading the login or sending anything.
- `primitive signup confirm` with no code source, more than one, or one that
  cannot be read is a usage error and exits 2 (it exited 1).
