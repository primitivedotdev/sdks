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

Previous versions: Node SDK, Python SDK and Go SDK 2.7.1; CLI 1.75.0. The preview of this release is `3.0.0-preview.3` for `primitive` and `@primitivedotdev/sdk` (npm `preview` dist-tag) and for the Go module (`sdk-go/v3.0.0-preview.3`), and `3.0.0rc3` for `primitivedotdev` on PyPI. It follows `3.0.0-preview.2` (`3.0.0rc2`), which added managing API keys from the CLI, and `3.0.0-preview.1` (`3.0.0rc1`).

What `3.0.0-preview.3` (`3.0.0rc3`) changes from `3.0.0-preview.2`:

- Creating, rotating and changing an API key from your own CLI login run
  directly. If the server asks for approval, the command still prints the
  approval link and takes `--step-up-token`.
- More CLI commands take `--json`, among them `routes list`, `org secrets
  list`, the `wake` commands, `memories` and `describe`.
- `email-rules list-email-rule-results` takes the email's id as
  `--email-id`, and so do `reply-to-email`, `signal-email` and
  `stop-repeat-from-email`; `--id` keeps working.
- `email-rules create-email-rule` and `test-email-rule` take `--kind`, so
  `do_not_share` can be set on a `--body-file` or `--raw-body` rule without
  editing its JSON.
- Generated list commands that page with `meta.cursor` say in their
  `--limit` and `--cursor` help how to page, and `memories search` prints
  its next cursor and takes `--envelope`.
- Email rules carry their `kind`, `evaluation_scope` and `scope_selection`,
  and a new rule reads only your own mailboxes unless you choose another
  scope.
- `feature_disabled` errors name the feature in `error.details.feature`.
- Python: the email rule request models gained `kind` before existing
  optional fields; pass optional fields by keyword. Go: re-encoding a
  decoded rule result no longer adds `author_left`.

### Breaking changes

#### Versions and module path

- The Node SDK, the Python SDK, the Go module and the CLI are all 3.0.0. The
  CLI moves from 1.75.0.
- The Go module path is `github.com/primitivedotdev/sdks/sdk-go/v3`. Update
  imports from `.../sdk-go/v2` and `.../sdk-go/v2/api`.
- `primitive functions init` scaffolds projects on `^3.0.0-preview.3` of both
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
optional fields by keyword, as the README examples do. For example, the email
rule request models (new in this release) gained `kind` after `explanation`
between the 3.0.0 previews.

Other generated model names follow the served document's schema names and
shapes. Among them: `MemoryScopeType0` and `MemoryScopeType1` are
`MemoryScope`; `CallerIdentity` is `WhoamiResponse200Data`;
`OrganizationLeft` is `LeaveOrganizationResult`; `InboxStatusEndpointSummary`,
`InboxStatusFunctionSummary` and `InboxStatusRecentEmailSummary` are
`InboxStatusEndpoints`, `InboxStatusFunctions` and `InboxStatusRecentEmails`.

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

159 operations, by area:

- Account: `getOwnGrant`.
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
  `getEmailRuleScope`, `listEmailRuleScopeOptions`, `listEmailRuleResults`.
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
- Emails: `getEmailReadable`.
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
  `updateSearchSettings`.
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
  `withdrawEmailRuleRequest`.
- Email rule shares: `listEmailRuleShares`, `listGivenEmailRuleShares`,
  `getEmailRuleShare`, `listEmailRuleShareEmails`, `endEmailRuleShare`.
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

- `Primitive-Step-Up` is a declared header parameter on the 33 operations that
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
  `setOwnMailboxAccess`, `removeOwnAgentAccess` and `setRelayAutoJoin`.
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
- `listSentEmails`: `since`, `wait`.
- `listAgentConnections`: `include_hidden`.
- `whoami`: `include`, `check`, `resource`.

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
- `primitive orgs` lists your organizations and whether the CLI may be used
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
  keep only that rule's entries. Node also exports the helper and the
  understanding types from `@primitivedotdev/sdk/api`.

#### Webhook validation errors

- The message of a missing-field validation error names the field's full
  path in all three SDKs, for example `Missing required field:
  email.content.raw` instead of `Missing required field: raw`. `field` and
  `suggestion` are unchanged.
- Node and Go report a payload without `email.content.raw` as missing
  `email.content.raw`, as Python already did, rather than as an error on
  `email.content.download` or `email.content`. The email event schema accepts
  and refuses the same payloads as before.

#### CLI

- `primitive billing` opens the dashboard's billing page, or prints its link.
- More commands take `--json`, which prints exactly one JSON document on
  stdout, failures included: `routes` (all of them), `org secrets`, `wake
  authorizations`, `wake dispatches` and `wake schedules`, `functions
  route-get`, `route-set`, `route-unset`, `routing-topology` and
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
  without `--json`, and comes in `meta.cursor` with `--json --envelope`.
- `memories search` can page: it prints `next cursor:` on stderr when there
  is another page, and takes `--envelope` to print `meta.cursor` with the
  data.
- A generated command whose operation can ask for browser approval takes
  `--step-up-token` (the `Primitive-Step-Up` header; `--primitive-step-up`
  still works) and `--no-browser`. When the server asks for approval, it
  prints the approval link, opens it where it can, waits for the one-time
  token and sends the request again, as `primitive keys` does; under
  `--json` or without a terminal it prints the link and how to rerun.
  `endpoints create` and `endpoints update` take them as well.
- `emails wait --since` and `emails watch --since` also take a duration
  ago, such as `15m` or `2h`. `emails wait` says in its help, and in its
  timeout message, that without `--since` or `--include-existing` it counts
  only mail received after it started.
- A generated command with exactly one path parameter takes it as its first
  argument too, so `primitive emails get <id>` and `primitive email-rules
  get-email-rule <id>` work; the flag (`--id`, `--email-id`) keeps working.
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
- Generated commands for the new operations, except `createKey`, `rotateKey`,
  `updateKey` and `revokeCredential`, which the `primitive keys` commands
  cover instead.
- The generated command for `leaveOrganization` is
  `roles-and-members:leave-organization`, following the operation's tag.
  `account:leave-organization` keeps working as an alias.
- Flags for the new parameters, for example `primitive emails:list-emails
  --thread-id --exclude-muted --search-regex --search-case-sensitive
  --search-negate --kind --content-discarded --group --include-presence`,
  `primitive emails:get-conversation --around --before --after --limit
  --text`, `primitive threads:get-thread --after`, `primitive
  sending:list-sent-emails --since --wait`, `primitive
  agent-connections:list-agent-connections --include-hidden` and `primitive
  account:whoami --include --check --resource`.
- `primitive domains verify` reads a failed DNS check from the
  `dns_verification_failed` error and names the records that still need
  work.
- The event listener stops with an explanation when an event's content is
  withheld from the credential, instead of passing on an event it cannot
  show.
