import type { PrimitiveOperationManifest } from "@primitivedotdev/api-core";

/** Canonical executable names. API operation identifiers stay unchanged. */
export const COMMAND_RENAMES: Readonly<Record<string, string>> = {
  "account:get-account": "account:get",
  "account:get-storage-stats": "account:storage",
  "account:get-webhook-secret": "account:webhook-secret",
  "account:leave-organization": "roles-and-members:leave",
  "account:show": "account:get",
  "account:update-account": "account:update",
  "activity:list-activity-objects": "activity:list",
  "address-notes:delete-address-note": "address-notes:delete",
  "address-notes:get-address-note": "address-notes:get",
  "address-notes:get-public-address-note": "address-notes:get-public",
  "address-notes:list-address-notes": "address-notes:list",
  "address-notes:list-address-notes-batch": "address-notes:list-batch",
  "address-notes:list-public-address-notes": "address-notes:list-public",
  "address-notes:put-address-note": "address-notes:set",
  "agent-connections:agent-connection-setup": "agent-connections:setup",
  "agent-connections:agent-connection-trusted-origins":
    "agent-connections:trusted-origins",
  "agent-connections:claim-agent-connection": "agent:connect",
  "agent-connections:create-agent-connection": "agent-connections:create",
  "agent-connections:get-agent-connection-settings":
    "agent-connections:get-settings",
  "agent-connections:get-own-agent-connection": "agent-connections:get-own",
  "agent-connections:invite-agent-connection": "agent-connections:invite",
  "agent-connections:list-agent-connections": "agent-connections:list",
  "agent-connections:remove-agent-connection": "agent-connections:delete",
  "agent-connections:rename-agent-connection": "agent-connections:rename",
  "agent-connections:revoke-agent-connection": "agent-connections:revoke",
  "agent-connections:set-agent-connection-visibility":
    "agent-connections:set-visibility",
  "agent-connections:update-agent-connection-settings":
    "agent-connections:update-settings",
  "agent-networks:add-default-network-member": "agent-networks:add-member",
  "agent-networks:check-default-network-contact-admission":
    "agent-networks:check-contact-admission",
  "agent-networks:get-default-network-agent": "agent-networks:get-agent",
  "agent-networks:list-agent-networks": "agent-networks:list",
  "agent-networks:list-default-network-agents": "agent-networks:list-agents",
  "agent-networks:list-default-network-members": "agent-networks:list-members",
  "agent-networks:remove-default-network-member":
    "agent-networks:delete-member",
  "agent-networks:update-default-network-member":
    "agent-networks:update-member",
  "agent-work:agent-work-agree-deadline": "agent-work:agree-deadline",
  "agent-work:agent-work-create": "agent-work:create",
  "agent-work:agent-work-get": "agent-work:get",
  "agent-work:agent-work-list": "agent-work:list",
  "agent-work:agent-work-manage-state": "agent-work:manage-state",
  "agent-work:agent-work-propose-deadline": "agent-work:propose-deadline",
  "agent-work:agent-work-report-status": "agent-work:report-status",
  "agent-work:agent-work-withdraw-deadline": "agent-work:withdraw-deadline",
  "agent:contacts:add": "agent:contacts:create",
  "agent:contacts:remove": "agent:contacts:delete",
  "agent:create-agent-account": "agent:create",
  "agent:create-agent-claim-link": "agent:claim-link",
  "agent:resend-agent-signup-verification": "agent:resend-signup",
  "agent:start-agent-claim": "agent:claim",
  "agent:start-agent-signup": "agent:start-signup",
  "agent:verify-agent-claim": "agent:claim-verify",
  "agent:verify-agent-signup": "agent:verify-signup",
  "changes:list-changes": "changes:list",
  "cli:cli-logout": "cli:logout",
  "cli:list-cli-orgs": "org:list",
  "cli:poll-cli-login": "cli:poll-login",
  "cli:resend-cli-signup-verification": "cli:resend-signup",
  "cli:start-cli-login": "cli:start-login",
  "cli:start-cli-signup": "cli:start-signup",
  "cli:verify-cli-signup": "cli:verify-signup",
  "contacts:add": "contacts:create",
  "contacts:delete-agent-contact": "contacts:delete-for-agent",
  "contacts:get-agent-contact-policy": "contacts:get-agent-policy",
  "contacts:get-contact-policy": "contacts:get-policy",
  "contacts:list-agent-contacts": "contacts:list-for-agent",
  "contacts:prepare-contact-acceptance": "contacts:prepare-acceptance",
  "contacts:prepare-contact-request": "contacts:prepare-request",
  "contacts:put-agent-contact": "contacts:set-for-agent",
  "contacts:put-agent-contact-policy": "contacts:set-agent-policy",
  "contacts:put-contact": "contacts:set",
  "contacts:put-contact-policy": "contacts:set-policy",
  "contacts:remove": "contacts:delete",
  "credentials:get-credential-policy": "credentials:get-policy",
  "credentials:get-key-builder": "credentials:key-builder",
  "credentials:get-key-suggestion": "credentials:key-suggestion",
  "credentials:list-credential-events": "credentials:list-events",
  "credentials:list-credentials": "credentials:list",
  "credentials:revoke-all-credentials": "credentials:revoke-all",
  "credentials:update-credential-policy": "credentials:update-policy",
  "credits:redeem-credit-code": "credits:redeem",
  "domains:add": "domains:create",
  "domains:add-domain": "domains:create",
  "domains:check-domain-dns": "domains:check-dns",
  "domains:check-vanity-inbox-name": "domains:check-vanity-name",
  "domains:claim-vanity-inbox-name": "domains:claim-vanity-name",
  "domains:delete-domain": "domains:delete",
  "domains:download-domain-zone-file": "domains:zone-file",
  "domains:get-domain-agent-authorization": "domains:get-agent-authorization",
  "domains:list-domains": "domains:list",
  "domains:update-domain": "domains:update",
  "domains:verify-domain": "domains:verify",
  "email-rule-oversight:accept-email-rule-objection":
    "email-rule-oversight:accept-objection",
  "email-rule-oversight:amend-email-rule-objection":
    "email-rule-oversight:amend-objection",
  "email-rule-oversight:create-email-rule-objection":
    "email-rule-oversight:create-objection",
  "email-rule-oversight:decline-email-rule-objection":
    "email-rule-oversight:decline-objection",
  "email-rule-oversight:get-email-rule-covering-me":
    "email-rule-oversight:get-covering-me",
  "email-rule-oversight:get-email-rule-objection":
    "email-rule-oversight:get-objection",
  "email-rule-oversight:list-email-rule-decisions-on-my-mail":
    "email-rule-oversight:list-decisions-on-my-mail",
  "email-rule-oversight:list-email-rule-objections":
    "email-rule-oversight:list-objections",
  "email-rule-oversight:list-email-rule-versions-covering-me":
    "email-rule-oversight:list-versions-covering-me",
  "email-rule-oversight:list-email-rules-covering-me":
    "email-rule-oversight:list-covering-me",
  "email-rule-oversight:withdraw-email-rule-objection":
    "email-rule-oversight:withdraw-objection",
  "email-rules:accept-email-rule-request": "email-rules:accept-request",
  "email-rules:check-email-rule-request-target":
    "email-rules:check-request-target",
  "email-rules:compile-email-rule": "email-rules:compile",
  "email-rules:create-email-rule": "email-rules:create",
  "email-rules:create-email-rule-request": "email-rules:create-request",
  "email-rules:decline-email-rule-request": "email-rules:decline-request",
  "email-rules:delete-email-rule": "email-rules:delete",
  "email-rules:delete-email-rule-request": "email-rules:delete-request",
  "email-rules:end-email-rule-share": "email-rules:end-share",
  "email-rules:get-email-rule": "email-rules:get",
  "email-rules:get-email-rule-request": "email-rules:get-request",
  "email-rules:get-email-rule-scope": "email-rules:get-scope",
  "email-rules:get-email-rule-share": "email-rules:get-share",
  "email-rules:get-email-rule-vocabulary": "email-rules:vocabulary",
  "email-rules:list-email-rule-decisions": "email-rules:list-decisions",
  "email-rules:list-email-rule-requests": "email-rules:list-requests",
  "email-rules:list-email-rule-results": "email-rules:list-results",
  "email-rules:list-email-rule-scope-options": "email-rules:list-scope-options",
  "email-rules:list-email-rule-share-emails": "email-rules:list-share-emails",
  "email-rules:list-email-rule-shares": "email-rules:list-shares",
  "email-rules:list-email-rule-versions": "email-rules:list-versions",
  "email-rules:list-email-rules": "email-rules:list",
  "email-rules:list-given-email-rule-shares": "email-rules:list-given-shares",
  "email-rules:test-email-rule": "email-rules:test",
  "email-rules:test-email-rule-on-sample": "email-rules:test-sample",
  "email-rules:update-email-rule": "email-rules:update",
  "email-rules:withdraw-email-rule-request": "email-rules:withdraw-request",
  "emails:delete-email": "emails:delete",
  "emails:discard-email-content": "emails:discard-content",
  "emails:download-email-attachment-archive-member":
    "emails:download-attachment-archive-member",
  "emails:download-email-attachment-by-filename":
    "emails:download-attachment-by-filename",
  "emails:download-email-attachment-part": "emails:download-attachment-part",
  "emails:download-raw-email": "emails:download-raw",
  "emails:get-conversation": "emails:conversation",
  "emails:get-email": "emails:get",
  "emails:get-email-readable": "emails:get-readable",
  "emails:list-email-attachment-archive-members":
    "emails:list-attachment-archive-members",
  "emails:list-emails": "emails:list",
  "emails:replay-email-webhooks": "emails:replay-webhooks",
  "emails:search-emails": "emails:search",
  "endpoints:complete-webhook-event": "endpoints:complete-event",
  "endpoints:create-endpoint": "endpoints:create",
  "endpoints:delete-endpoint": "endpoints:delete",
  "endpoints:get-endpoint": "endpoints:get",
  "endpoints:get-endpoint-signing-secret": "endpoints:signing-secret",
  "endpoints:list-endpoints": "endpoints:list",
  "endpoints:pull-webhook-event": "endpoints:pull-event",
  "endpoints:rotate-endpoint-signing-secret": "endpoints:rotate-signing-secret",
  "endpoints:test-endpoint": "endpoints:test",
  "endpoints:test-endpoint-rules": "endpoints:test-rules",
  "endpoints:update-endpoint": "endpoints:update",
  "filters:create-filter": "filters:create",
  "filters:delete-filter": "filters:delete",
  "filters:list-filters": "filters:list",
  "filters:update-filter": "filters:update",
  "functions:create-function": "functions:create",
  "functions:create-function-secret": "functions:create-secret",
  "functions:delete-function": "functions:delete",
  "functions:delete-function-secret": "functions:delete-secret",
  "functions:get-function": "functions:get",
  "functions:get-function-deployment": "functions:get-deployment",
  "functions:get-function-invocation": "functions:get-invocation",
  "functions:get-function-routing": "functions:get-routing",
  "functions:get-function-runtime-key": "functions:get-runtime-key",
  "functions:get-function-source": "functions:get-source",
  "functions:get-function-test-run-trace": "functions:get-test-trace",
  "functions:get-function-usage": "functions:get-usage",
  "functions:get-function-users": "functions:get-users",
  "functions:get-org-function-fallback": "functions:get-org-fallback",
  "functions:get-org-function-invocation-series":
    "functions:get-org-invocation-series",
  "functions:get-org-function-usage": "functions:get-org-usage",
  "functions:get-org-routing-topology": "functions:get-org-routing",
  "functions:list-function-activity": "functions:list-activity",
  "functions:list-function-deployments": "functions:list-deployments",
  "functions:list-function-invocations": "functions:list-invocations",
  "functions:list-function-logs": "functions:list-logs",
  "functions:list-function-runtime-key-presets":
    "functions:list-runtime-key-presets",
  "functions:list-function-secrets": "functions:list-secrets",
  "functions:list-functions": "functions:list",
  "functions:lookup-function": "functions:lookup",
  "functions:reaffirm-function-runtime-key": "functions:reaffirm-runtime-key",
  "functions:request-function-runtime-key-runner":
    "functions:request-runtime-key-runner",
  "functions:route-get": "functions:get-route",
  "functions:route-set": "functions:set-route",
  "functions:route-unset": "functions:unset-route",
  "functions:set-function-runtime-key": "functions:set-runtime-key",
  "functions:suspend-function-runtime-key": "functions:suspend-runtime-key",
  "functions:test-function": "functions:test",
  "functions:update-function": "functions:update",
  "functions:update-function-tags": "functions:update-tags",
  "inbox:get-inbox-status": "inbox:status",
  "interactions:get-interaction": "interactions:get",
  "interactions:list-interactions": "interactions:list",
  "interactions:send-interaction-step": "interactions:send-step",
  "interactions:start-interaction": "interactions:start",
  "org:secrets:remove": "org:secrets:delete",
  "organization-settings:get-organization": "organization-settings:get",
  "organization-settings:list-oauth-grants":
    "organization-settings:list-grants",
  "organization-settings:remove-organization-logo":
    "organization-settings:delete-logo",
  "organization-settings:revoke-oauth-grant":
    "organization-settings:revoke-grant",
  "organization-settings:update-organization": "organization-settings:update",
  "organization-settings:update-organization-logo":
    "organization-settings:update-logo",
  "organizations:invite-organization-member": "organizations:invite-member",
  "organizations:list-organization-invitations":
    "organizations:list-invitations",
  "organizations:revoke-organization-invitation":
    "organizations:revoke-invitation",
  orgs: "org:list",
  "projects:create-project": "projects:create",
  "projects:delete-project": "projects:delete",
  "projects:get-project": "projects:get",
  "projects:invite-project-member": "projects:invite-member",
  "projects:list-project-invitations": "projects:list-invitations",
  "projects:list-projects": "projects:list",
  "projects:revoke-project-invitation": "projects:revoke-invitation",
  "projects:update-project": "projects:update",
  "repeating-sends:delete-repeating-send": "repeating-sends:delete",
  "repeating-sends:get-repeating-send": "repeating-sends:get",
  "repeating-sends:list-repeating-sends": "repeating-sends:list",
  "repeating-sends:stop-repeat-from-email": "repeating-sends:stop-from-email",
  "repeating-sends:update-repeating-send": "repeating-sends:update",
  "roles-and-members:leave-organization": "roles-and-members:leave",
  "routes:add": "routes:create",
  "routes:remove": "routes:delete",
  "routes:simulate-route": "routes:simulate",
  "search:semantic-search": "semantic-search",
  "sending:cancel-sent-email": "sending:cancel",
  "sending:cancel-sent-email-by-idempotency-key": "sending:cancel-by-key",
  "sending:delete-sent-email": "sent:delete",
  "sending:download-sent-attachment-archive-member":
    "sending:download-attachment-archive-member",
  "sending:download-sent-attachment-by-filename":
    "sending:download-attachment-by-filename",
  "sending:download-sent-attachment-part": "sending:download-attachment-part",
  "sending:download-sent-attachments": "sending:download-attachments",
  "sending:get-send-permissions": "sending:permissions",
  "sending:get-sent-email": "sending:get",
  "sending:list-sent-attachment-archive-members":
    "sending:list-attachment-archive-members",
  "sending:list-sent-emails": "sending:list",
  "sending:release-sent-email": "sending:release",
  "sending:reply-to-email": "sending:reply",
  "sending:reschedule-sent-email": "sending:reschedule",
  "sending:send-email": "sending:send",
  "sending:send-mail-batch": "sending:send-batch",
  "sending:signal-email": "sending:signal",
  "stats:get-inbound-hourly-stats": "stats:inbound-hourly",
  "stats:get-sent-hourly-stats": "stats:sent-hourly",
  "stats:get-webhook-delivery-stats": "stats:webhook-deliveries",
  "templates:get-template": "templates:get",
  "templates:get-template-install": "templates:get-install",
  "templates:install-template": "templates:install",
  "templates:list-templates": "templates:list",
  "threads:get-thread": "threads:get",
  "threads:list-muted-threads": "threads:list-muted",
  "threads:list-thread-read-states": "threads:list-read-states",
  "threads:mark-thread-read": "threads:mark-read",
  "webhook-deliveries:get-delivery": "webhook-deliveries:get",
  "webhook-deliveries:list-deliveries": "webhook-deliveries:list",
  "webhook-deliveries:replay-delivery": "webhook-deliveries:replay",
};

export function canonicalCommandId(id: string): string {
  return Object.hasOwn(COMMAND_RENAMES, id) ? (COMMAND_RENAMES[id] ?? id) : id;
}

/** Join presentation fields, including operations offered at the root. */
export function operationCommandId(
  operation: Pick<PrimitiveOperationManifest, "tagCommand" | "command">,
): string {
  return [operation.tagCommand, operation.command].filter(Boolean).join(":");
}

export function canonicalOperation(
  operation: PrimitiveOperationManifest,
): PrimitiveOperationManifest {
  const id = canonicalCommandId(operationCommandId(operation));
  const at = id.lastIndexOf(":");
  return {
    ...operation,
    ...(typeof operation.description === "string"
      ? { description: canonicalCliText(operation.description) }
      : {}),
    tagCommand: at < 0 ? "" : id.slice(0, at),
    command: id.slice(at + 1),
  };
}

const SCOPE_OPERATIONS: ReadonlySet<string> = new Set([
  "compileEmailRule",
  "createEmailRule",
  "updateEmailRule",
  "testEmailRule",
  "testEmailRuleOnSample",
  "generateLookAlikes",
]);

/** CLI flags project to the original request-body field, never a renamed wire key. */
export function canonicalBodyFlagName(
  sdkName: string,
  property: string,
): string {
  return property === "evaluation_scope" && SCOPE_OPERATIONS.has(sdkName)
    ? "scope"
    : property.replace(/_/g, "-");
}

/** Rekey registrations without keeping retired names as executable aliases. */
export function canonicalCommands<T>(
  commands: Record<string, T>,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [oldId, command] of Object.entries(commands)) {
    const id = canonicalCommandId(oldId);
    if (Object.hasOwn(result, id) && result[id] !== command)
      throw new Error(`Different command implementations collide at ${id}`);
    result[id] = command;
  }
  return result;
}

// Rewrite only CLI invocations and flag spellings in presentation text. The
// source API schema and its wire-field identifiers remain untouched.
const commandTextPattern = new RegExp(
  `\\b(primitive(?:@[a-zA-Z0-9.+-]+)?|prim)[ \t]+(${Object.keys(COMMAND_RENAMES)
    .sort((a, b) => b.length - a.length)
    .map((id) => id.split(":").join("(?:[ \t]+|:)"))
    .join("|")})(?![a-zA-Z0-9_:-])`,
  "g",
);

export function canonicalCliText(text: string): string {
  return text
    .replace(
      commandTextPattern,
      (_match, bin: string, name: string) =>
        `${bin} ${canonicalCommandId(name.replace(/[ \t]+/g, ":")).replaceAll(":", " ")}`,
    )
    .replaceAll("--evaluation-scope", "--scope")
    .replaceAll("--add-expectation-samples-file", "--add-samples-file")
    .replaceAll("--expectation-samples-file", "--samples-file");
}

/** Detect retired paths before a positional parent can consume one as a value. */
export function retiredCommandTarget(
  argv: readonly string[],
): { oldId: string; newId: string } | undefined {
  let id = "";
  let match: { oldId: string; newId: string } | undefined;
  for (const word of argv) {
    // A flag or explicit -- ends the command path. Values after it must not
    // be mistaken for subcommands, including literal search queries.
    if (word.startsWith("-")) break;
    id = id ? `${id}:${word}` : word;
    const replacement = Object.hasOwn(COMMAND_RENAMES, id)
      ? COMMAND_RENAMES[id]
      : undefined;
    if (replacement) match = { oldId: id, newId: replacement };
  }
  return match;
}
