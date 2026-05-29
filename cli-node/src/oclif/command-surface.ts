import type { PrimitiveOperationManifest } from "@primitivedotdev/api-core";

export function operationId(operation: PrimitiveOperationManifest): string {
  return `${operation.tagCommand}:${operation.command}`;
}

export const CANONICAL_OPERATION_COMMANDS: Record<string, string> = {
  "account:get-account": "account:show",
  "account:get-storage-stats": "account:storage",
  "account:get-webhook-secret": "account:webhook-secret",
  "account:update-account": "account:update",
  "domains:add-domain": "domains:add",
  "domains:delete-domain": "domains:delete",
  "domains:list-domains": "domains:list",
  "domains:update-domain": "domains:update",
  "domains:verify-domain": "domains:verify",
  "emails:delete-email": "emails:delete",
  "emails:discard-email-content": "emails:discard-content",
  "emails:download-raw-email": "emails:download-raw",
  "emails:get-conversation": "emails:conversation",
  "emails:get-email": "emails:get",
  "emails:list-emails": "emails:list",
  "emails:replay-email-webhooks": "emails:replay-webhooks",
  "emails:search-emails": "emails:search",
  "endpoints:create-endpoint": "endpoints:create",
  "endpoints:delete-endpoint": "endpoints:delete",
  "endpoints:list-endpoints": "endpoints:list",
  "endpoints:test-endpoint": "endpoints:test",
  "endpoints:update-endpoint": "endpoints:update",
  "filters:create-filter": "filters:create",
  "filters:delete-filter": "filters:delete",
  "filters:list-filters": "filters:list",
  "filters:update-filter": "filters:update",
  "functions:delete-function": "functions:delete",
  "functions:delete-function-secret": "functions:delete-secret",
  "functions:get-function": "functions:get",
  "functions:get-function-test-run-trace": "functions:test-trace",
  "functions:list-function-secrets": "functions:list-secrets",
  "functions:list-functions": "functions:list",
  "sending:get-send-permissions": "sending:permissions",
  "sending:get-sent-email": "sent:get",
  "sending:list-sent-emails": "sent:list",
  "threads:get-thread": "threads:get",
  "webhook-deliveries:list-deliveries": "deliveries:list",
  "webhook-deliveries:replay-delivery": "deliveries:replay",
};

export const REPLACED_OR_INTERNAL_OPERATION_IDS = new Set<string>([
  "agent:resend-agent-signup-verification",
  "agent:start-agent-signup",
  "agent:verify-agent-signup",
  "cli:cli-logout",
  "cli:poll-cli-login",
  "cli:resend-cli-signup-verification",
  "cli:start-cli-login",
  "cli:start-cli-signup",
  "cli:verify-cli-signup",
  "domains:download-domain-zone-file",
  "functions:create-function",
  "functions:create-function-secret",
  "functions:list-function-logs",
  "functions:set-function-secret",
  "functions:test-function",
  "functions:update-function",
  "inbox:get-inbox-status",
  "search:semantic-search",
  "sending:reply-to-email",
  "sending:send-email",
]);

export function publicOperationCommandId(
  operation: PrimitiveOperationManifest,
): string {
  const id = operationId(operation);
  return CANONICAL_OPERATION_COMMANDS[id] ?? id;
}

export function isPublicGeneratedOperation(
  operation: PrimitiveOperationManifest,
): boolean {
  return !REPLACED_OR_INTERNAL_OPERATION_IDS.has(operationId(operation));
}
