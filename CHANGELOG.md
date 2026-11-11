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

Previous versions: Node SDK, Python SDK and Go SDK 2.7.1; CLI 1.75.0. The preview of this release is `3.0.0-preview.6` for `primitive` and `@primitivedotdev/sdk` (npm `preview` dist-tag) and for the Go module (`sdk-go/v3.0.0-preview.6`), and `3.0.0rc6` for `primitivedotdev` on PyPI. It follows `3.0.0-preview.5` (`3.0.0rc5`), which took send's default From from the API and added `primitive activity created`, `3.0.0-preview.4` (`3.0.0rc4`), which added expectations to email rule authoring, `3.0.0-preview.3` (`3.0.0rc3`), `3.0.0-preview.2` (`3.0.0rc2`) and `3.0.0-preview.1` (`3.0.0rc1`).

What `3.0.0-preview.6` (`3.0.0rc6`) changes from `3.0.0-preview.5`:

- The spec follows the API's current release. Among the new fields: whether a
  webhook delivery will be retried (`retry_scheduled`), whether an endpoint is
  being sent mail and why not (`delivery`), an endpoint test's `reachable` and
  `delivery`, rotation links on keys, revoked keys and repeat revokes, which
  do-not-share rules kept a match back (`withheld_by`), the email each rule
  result is about, a rule request's message and decline reason, and the email
  rule request webhook events. `operator` is no longer a built-in role key.
  The breaking changes are listed below.
- Keys: `keys update` and `keys rotate` take `--expires-at` and `--no-expiry`;
  `keys update` takes `--add-rule` and `--remove-rule`, restates a grant only
  when the key read shows its resource limits, and takes ended rules off;
  `keys get` shows when a revoked key was revoked.
- `email-rules delete-email-rule` asks before deleting (`--yes` without a
  terminal) and reports the shares it ended and the keys still listing the
  rule.
- `primitive activity asked` lists the rule requests made to you.
- `whoami` names you by your member address and shows the account email apart;
  role lines say what kind of role they are.
- `emails wait` and `emails watch` report mail that becomes readable after a
  later email was already reported.
- Without a terminal, email-code login, signup and other prompting commands
  refuse at once and name the flag to pass; an address on a domain managed by
  Primitive is pointed at `primitive login browser`.
- A background listener keeps receiving across a CLI upgrade, and keeps its
  supervisor when a new worker exits right after starting.
- An empty email list says what the credential can read, and giving a role
  that reads every mailbox says so.
- Creating an endpoint at a deleted endpoint's URL makes a new endpoint, and
  a URL already held on the same domain is refused.

### Breaking changes

#### Versions and module path

- The Node SDK, the Python SDK, the Go module and the CLI are all 3.0.0. The
  CLI moves from 1.75.0.
- The Go module path is `github.com/primitivedotdev/sdks/sdk-go/v3`. Update
  imports from `.../sdk-go/v2` and `.../sdk-go/v2/api`.
- `primitive functions init` scaffolds projects on `^3.0.0-preview.6` of both
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

- `explanation` is optional on `createEmailRule` and
  `createEmailRuleRequest` bodies: the server writes one when it is left out.
  In Go, `Explanation` on `CreateEmailRuleRequest` and
  `CreateEmailRuleRequestRequest` is an `OptString`; in Python it moves after
  the required fields.
- Go: `ListEmailRuleVersionsParams.Versions` is an `OptString`.

Python (`primitive.api.models`):

- `EmailRule` replaces `ListEmailRulesResultItem`.
- `EmailRuleEvaluationScope` replaces `ListEmailRulesResultItemEvaluationScope`.
- `EmailRuleKind` replaces `ListEmailRulesResultItemKind`.
- `EmailRuleRequest` replaces `AcceptEmailRuleRequestResultRequest`, `ListEmailRuleRequestsResultItem`.
- `EmailRuleRequestProposedVia` replaces `AcceptEmailRuleRequestResultRequestProposedVia`, `ListEmailRuleRequestsResultItemProposedVia`.
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
- `EmailRuleRequestProposedVia` replaces `AcceptEmailRuleRequestResultRequestProposedVia`, `DeclineEmailRuleRequestResultProposedVia`, `GetEmailRuleRequestResultProposedVia`, `ListEmailRuleRequestsResultItemProposedVia`, `WithdrawEmailRuleRequestResultProposedVia`.
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
- A rule write's `expectations_check.passed` can be null: in Go it is a
  `NilBool` instead of a `bool` on `EmailRuleWrittenExpectationsCheck`, and
  in Python `bool | None` on the expectations check models. A null `passed` means none failed but some are undecided.

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
  `recipient_outside_access` and `recipient_rules_only`. In Go
  `ListEmailsOK.Meta` is `EmailListMeta` instead of `PaginationMeta`, and in
  Python `ListEmailsResponse200.meta` is `EmailListMeta`. Node's
  `EmailListMeta` extends `PaginationMeta`.

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
- `email-rules delete-email-rule` asks for confirmation in a terminal, as
  `keys revoke` does. Without a terminal, or with `--json`, it needs `--yes`
  (`-y`): otherwise it exits 2 and sends nothing. An answer other than `y` or
  `yes` exits 1 and the rule is kept.

#### CLI whoami and role text

- `primitive whoami` text output changed: the first line names your member
  address instead of the account's email, and the role line reads
  `Built-in role:`. A script that reads the email should use `whoami --json`
  and its `email` field, which is unchanged. API keys and other credentials
  that are not a person's login no longer print a role line; read `role`
  from `whoami --json --grant`. `orgs` rows read `built-in role <key>` or
  `role restricted`, followed by a `role restricted:` note line when a row
  is restricted, `org use` labels the role the same way, and `roles groups`
  rows read `role id`.
- For an API key, the `Grant:` line of `primitive whoami` names the key id.
  For a key whose scope lists email rules it names them by id (`mail that
  email rule <id> granted, while it stays active`, the first three and how
  many more) instead of `a narrowed mail scope`, since a key cannot read the
  rules themselves. A scope the server could not read, or one that names no
  mailbox, domain or rule, says it reaches no mail.

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

166 operations, by area:

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
  `getEmailRuleVocabulary`.
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
  `withdrawEmailRuleRequest`, `deleteEmailRuleRequest`,
  `checkEmailRuleRequestTarget`.
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

- `rotateKey` takes `expires_at`: the new key's expiry, a time or null for
  none, instead of the old key's.
- `listActivityObjects` takes `relation`: `created` (the default) or `asked`,
  what other members asked of you.
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
- `listSentEmails`: `since`, `wait`.
- `listAgentConnections`: `include_hidden`.
- `whoami`: `include`, `check`, `resource`.
- Email rules:
  - `compileEmailRule` takes `kind`.
  - `createEmailRule` and `updateEmailRule` take `expectations` (the emails a
    rule should and should not match), and their answers carry
    `expectations_check` and `scope_warnings`. `updateEmailRule` takes
    `if_version`: a stale version is refused with `409` and
    `details.reason` `version_moved`.
  - `getEmailRule` carries `expectations`.
  - A rule carries `revision`, which moves on with every update, and
    `author` (`EmailRuleAuthor`: `user_id`, and `name` and `email` when you
    may see them).
  - `compileEmailRule` answers `breadth` (`EmailRuleBreadth`: of your
    recent emails, how many were `checked` and how many the conditions
    `matched`), null when not counted in full. The create, update, request
    and accept bodies take it back, as `EmailRuleBreadth` or null, and ignore
    it.
  - `updateEmailRule` takes `if_revision`, refused with `409`
    `email_rule_conflict`, `details.reason` `revision_moved` and
    `details.current_revision` when the rule was updated since.
  - `updateEmailRule` takes `if_expectations_pass`: it judges the rule as
    the write would leave it against its expectations before saving, and
    refuses with `409` `expectations_failed` or `expectations_undecided`
    (with `details.expectations_check`) or `400` `no_expectations`, saving
    nothing. Only a write that saves a version or turns the rule active is
    judged.
  - `updateEmailRule` takes `restore_version`, which saves an earlier
    version again as the next one; its answer then carries `restored_from`.
  - After a write that saved a version, the `updateEmailRule` answer
    carries `affects` (`keys`, `endpoints`, `shares_ended`), and
    `expectations_check.note` when the saved version did not pass.
  - An `email_rule_conflict` can also have `details.reason`
    `expectations_moved` or `rule_changed`.
  - `testEmailRule` takes `expect` and answers with `expectations`,
    `scope_warnings` and `summary`. Its results carry `values` and
    `question_answers_source`, and `testEmailRuleOnSample` answers with
    `values`.
  - `getEmailRuleScope` carries `scope_warnings` and `reads_nothing`.
  - `listEmailRuleResults` carries the email's `classification`.
  - `listEmailRuleDecisions` carries each email's `from_address`, `subject`
    and `received_at`.
  - `listEmailRuleVersions` lists versions newest first with `limit` and
    `cursor`; `versions` is optional.
  - `createEmailRuleRequest` answers with `target_can_accept` and
    `target_warning`.
  - `listEmailRuleDecisions` and `listEmailRuleResults` carry
    `detail_withheld` on a decision whose email's content cannot be read;
    `testEmailRule` answers carry `questions.stored`.
  - `acceptEmailRuleRequest` needs `mail:share_own` (sharing your own mail
    through email rules), no longer `mail:send_as_member`. The Node
    `PERMISSIONS` list gains `mail:share_own`. `createRole` and
    `updateRole` refuse a permission whose prerequisite is not in the same
    role, with `400` and `details.reason` `unmet_requirement`.
  - New error code: `email_rule_request_not_withdrawn`.
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
  - `revokeCredential` answers `already_revoked: true`, with `revoked` 0,
    for an API key that was already revoked.
  - `listKeys` items and `getKey` carry `rotated_from` and `rotated_to`: the
    key this one was rotated from, and the newest key rotated from it, among
    those the caller may read.
  - `revokeCredential` declares `standing_objects` (`kind`, `id`, `label`,
    `org_owned`): what the credential set up or owns and, for an API key,
    what it carries on for the keys it was rotated from. What the
    organization owns keeps working; anything else keeps working only while
    someone can still act for it, such as a key of the same rotation that
    still works. It also declares `keep_failed`, the items chosen to keep that
    could not be taken over.
- `getDelivery` carries `attempts`; it and `listDeliveries` carry
  `latest_attempt`, `next_attempt_at`, `response_status` and
  `response_body`.
- `ErrorResponse.error.details` declares `feature`, `feature_name`,
  `enabled_by` and `contact_email`, which a `feature_disabled` error
  carries.
- `decideSuspension` declares `502` and `503`; in Go they are typed
  responses.
- Email rules:
  - `testEmailRule` can answer an email `skipped`, with `skipped_reason`
    (`unparsed`, `rejected` or `content_discarded`), and its `counts`
    carry `skipped`. A skipped expectation is undecided.
  - In the `expectations_check` of `createEmailRule` and `updateEmailRule`,
    `passed` is null when none failed but some are undecided, and `decided`
    says whether every expectation was judged.
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
  - `listEmailRuleResults` answers with `email` (its `id`, `from_address`,
    `recipient`, `subject` and `received_at`), and each rule's decision
    carries `near_miss`.
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

#### Rule request webhook events

- The catalogs list `email_rule_request.created`, `accepted`, `declined` and
  `withdrawn` (`EMAIL_RULE_REQUEST_EVENT_TYPES` in Node and Python,
  `EmailRuleRequestEventTypes` in Go). The Node SDK also has the body's shape
  (`EmailRuleRequestEvent`) and a type guard (`isEmailRuleRequestEvent`). Each goes to the person who did not act, only
  to a webhook that person made for them, and only when the webhook lists
  them. The body always carries the asker's `message` and a decline's
  `decline_reason` (null when there is none), and `type` but not `event`, so
  parse it with the `X-Webhook-Event` header.
- A webhook for these events is an http webhook made for them when it is
  created, by a person signed in as themself; one made with an API key,
  another app or an agent is refused, and an existing webhook cannot be given
  them. It is its maker's own whatever their access: only they can change it,
  and it cannot be given to an API key. It is always a route target, so it
  receives mail only through routes; asking for it to be a default
  (`is_route_target: false`, or a takeover) is refused.
- `--event-types 'email_rule_request.*'` expands to the four events, as
  `sent_email.*` does. When creating or changing such a webhook is refused,
  `endpoints create-endpoint` and `update-endpoint` say what to do instead.

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

- `send` and `chat` without `--from`, for a credential whose grant has no
  `mail:send`, say that it has no `mail:send` and what would give it the
  permission (for an API key, `keys update <key id> --add mail:send`), and
  exit 1 with `code` `grant_forbidden` and `details` `{ "permission":
  "mail:send", "reason": "permission_missing" }`, as the send itself refuses
  it. They do not ask for `--from`, which could not help. When `send`,
  `reply` or `chat` stops on an error of the CLI's own rather than an API
  answer, the `--json` envelope's `error` keeps that error's `code` and
  `details`.
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
  first, open or answered: the rule requests made to you, each with its
  state, who asked and its id. It takes `--state`, `--limit`, `--cursor`,
  `--all` and `--json`.
- `primitive activity created` lists what you created, newest first, with
  where each object stands now. Signed in with `primitive login`, it covers
  what you created through any credential of yours, names the credential on
  each row, and includes your API keys, agents, email rules and rule
  requests; with an API key or an agent's key, it lists what that key
  created. Kinds your access does not let you list are named at the end, with
  the permission that would show them. It takes `--kind`, `--state`,
  `--limit`, `--cursor`, `--all` and `--json`.
- Without `--json`, `email-rules delete-email-rule` reads out on stderr what
  the delete left: the shares it ended, and the keys that still list the rule
  and now read nothing through it, with the `keys update --remove-rule`
  command that takes the rule off.
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
- The help for `email-rules test-email-rule`, `create-email-rule` and
  `update-email-rule` names both expectation reports: a test answers with
  `expectations` (`passed`, `counts`, `results`), and a create or update
  with `expectations_check` (`passed`, `decided`, `failed`, `undecided`).
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
- `primitive endpoints get <id>` reads one webhook endpoint, and
  `primitive email-rules vocabulary` prints the column catalog a hand-written
  rule tree is checked against. `email-rules delete-email-rule-request`
  deletes a request you made and withdrew, `email-rules
  check-email-rule-request-target` says whether a member can accept a request
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
  - `routes add`, `routes update`, `routes create-route` and
    `routes update-route` print each of the route's `warnings`.
  - `webhook-deliveries get-delivery` lists each attempt with when it was
    made, its status and error code, and what the endpoint answered: the
    HTTP status and the start of its body (terminal controls removed), or
    that no answer was recorded.
  - `create-email-rule` and `update-email-rule` say "none failed" when an
    expectations check has only undecided expectations (`passed` null), and
    say when the rule blocks sharing (`kind` `do_not_share`).
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
  expectations. It is 1 when one failed, or when one is undecided and testing
  again will not decide it (its email cannot be found or read, cannot be
  classified, or is `skipped` because it cannot be tested), and 3 when the
  only undecided ones a later test can decide
  (not classified yet, or a question unanswered). Without `--json` it prints
  a report on stderr after the JSON: the summary's warnings, scope warnings,
  how each condition held and failed, the expectations with why each
  undecided one is undecided, and for each email that did not match the
  values its conditions compared. Under `--json` the report is left out, and
  when the exit code is not 0 the document carries `exit_code` and an
  `error` whose `code` is `expectations_failed`, `expectations_unresolvable`
  or `expectations_undecided` (exit 3). Exit 1 also means the request failed,
  with the API's own error code; `--json` tells the two apart.
- `email-rules create-email-rule` and `update-email-rule` take
  `--expectations-file`, a JSON file with the emails the rule must match and
  must not; on update, a file holding `null` removes them. Without `--json`
  they print the `expectations_check` result and the version it ran on.
  They exit 0 whatever that result says unless given
  `--fail-on-expectations`: then they exit 1 when an expectation failed, and
  3 when none failed but one is undecided or the expectations the write sent
  were not checked, so test the rule to decide. Under `--json`, when the exit
  code is not 0 the document carries `exit_code` and an `error` whose `code`
  is `expectations_failed`, `expectations_undecided` or
  `expectations_unchecked`. Exit 1 also means the request failed, with the
  API's own error code.
- Without `--json`, `email-rules create-email-rule`, `update-email-rule` and
  `get-email-rule-scope` print each scope warning on stderr, and
  `get-email-rule-scope` says when the rule reads no mail (`reads_nothing`).
- When `email-rules update-email-rule --if-version` answers 409 because the
  rule's version moved, a hint names its current version, when the answer
  gives one, and says to read the rule again with `primitive email-rules
  get-email-rule <id>` and reapply the change.
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
  `Role key:`. `login`, `org use` and `orgs` print
  the stored role as `built-in role owner`, `built-in role admin` or
  `built-in role member`, or as `role restricted`, and explain `restricted`:
  a template or custom role that does not fully include member, because it
  lacks some member permission (as Operator does) or reaches only some
  mailboxes (and, in `orgs`, no role at all).
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
