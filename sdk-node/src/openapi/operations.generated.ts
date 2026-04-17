/**
 * Generated operation metadata for the Primitive API CLI and SDK tooling.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run `pnpm generate:openapi` to regenerate.
 */

export type PrimitiveParameterManifest = {
  description: string | null;
  name: string;
  required: boolean;
  type: string;
};

export type PrimitiveOperationManifest = {
  binaryResponse: boolean;
  bodyRequired: boolean;
  command: string;
  description: string | null;
  hasJsonBody: boolean;
  method: string;
  operationId: string;
  path: string;
  pathParams: PrimitiveParameterManifest[];
  queryParams: PrimitiveParameterManifest[];
  sdkName: string;
  summary: string | null;
  tag: string;
  tagCommand: string;
};

export const operationManifest: PrimitiveOperationManifest[] = [
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "get-account",
    "description": null,
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "getAccount",
    "path": "/account",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "getAccount",
    "summary": "Get account info",
    "tag": "Account",
    "tagCommand": "account"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "get-storage-stats",
    "description": null,
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "getStorageStats",
    "path": "/account/storage",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "getStorageStats",
    "summary": "Get storage usage",
    "tag": "Account",
    "tagCommand": "account"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "get-webhook-secret",
    "description": "Returns the webhook signing secret for your account. If no secret\nexists yet, one is generated automatically on first access.\n",
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "getWebhookSecret",
    "path": "/account/webhook-secret",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "getWebhookSecret",
    "summary": "Get webhook signing secret",
    "tag": "Account",
    "tagCommand": "account"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "rotate-webhook-secret",
    "description": "Generates a new webhook signing secret, replacing the current one.\nRate limited to once per 60 minutes.\n",
    "hasJsonBody": false,
    "method": "POST",
    "operationId": "rotateWebhookSecret",
    "path": "/account/webhook-secret/rotate",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "rotateWebhookSecret",
    "summary": "Rotate webhook signing secret",
    "tag": "Account",
    "tagCommand": "account"
  },
  {
    "binaryResponse": false,
    "bodyRequired": true,
    "command": "update-account",
    "description": null,
    "hasJsonBody": true,
    "method": "PATCH",
    "operationId": "updateAccount",
    "path": "/account",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "updateAccount",
    "summary": "Update account settings",
    "tag": "Account",
    "tagCommand": "account"
  },
  {
    "binaryResponse": false,
    "bodyRequired": true,
    "command": "add-domain",
    "description": "Creates an unverified domain claim. You will receive a\n`verification_token` to add as a DNS TXT record before\ncalling the verify endpoint.\n",
    "hasJsonBody": true,
    "method": "POST",
    "operationId": "addDomain",
    "path": "/domains",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "addDomain",
    "summary": "Claim a new domain",
    "tag": "Domains",
    "tagCommand": "domains"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "delete-domain",
    "description": "Deletes a verified or unverified domain claim.",
    "hasJsonBody": false,
    "method": "DELETE",
    "operationId": "deleteDomain",
    "path": "/domains/{id}",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "deleteDomain",
    "summary": "Delete a domain",
    "tag": "Domains",
    "tagCommand": "domains"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "list-domains",
    "description": "Returns all verified and unverified domains for your organization,\nsorted by creation date (newest first). Each domain includes a\n`verified` boolean to distinguish between the two states.\n",
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "listDomains",
    "path": "/domains",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "listDomains",
    "summary": "List all domains",
    "tag": "Domains",
    "tagCommand": "domains"
  },
  {
    "binaryResponse": false,
    "bodyRequired": true,
    "command": "update-domain",
    "description": "Update a verified domain's settings. Only verified domains can be\nupdated. Per-domain spam thresholds require a Pro plan.\n",
    "hasJsonBody": true,
    "method": "PATCH",
    "operationId": "updateDomain",
    "path": "/domains/{id}",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "updateDomain",
    "summary": "Update domain settings",
    "tag": "Domains",
    "tagCommand": "domains"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "verify-domain",
    "description": "Checks DNS records (MX and TXT) to verify domain ownership.\nOn success, the domain is promoted from unverified to verified.\nOn failure, returns which checks passed and which failed.\n",
    "hasJsonBody": false,
    "method": "POST",
    "operationId": "verifyDomain",
    "path": "/domains/{id}/verify",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "verifyDomain",
    "summary": "Verify domain ownership",
    "tag": "Domains",
    "tagCommand": "domains"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "delete-email",
    "description": null,
    "hasJsonBody": false,
    "method": "DELETE",
    "operationId": "deleteEmail",
    "path": "/emails/{id}",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "deleteEmail",
    "summary": "Delete an email",
    "tag": "Emails",
    "tagCommand": "emails"
  },
  {
    "binaryResponse": true,
    "bodyRequired": false,
    "command": "download-attachments",
    "description": "Downloads all attachments as a gzip-compressed tar archive.\nAuthenticates via a signed download token (provided in webhook\npayloads) or a valid session.\n",
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "downloadAttachments",
    "path": "/emails/{id}/attachments.tar.gz",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [
      {
        "description": "Signed download token from webhook payload",
        "name": "token",
        "required": false,
        "type": "string"
      }
    ],
    "sdkName": "downloadAttachments",
    "summary": "Download email attachments",
    "tag": "Emails",
    "tagCommand": "emails"
  },
  {
    "binaryResponse": true,
    "bodyRequired": false,
    "command": "download-raw-email",
    "description": "Downloads the raw RFC 822 email file (.eml). Authenticates via\na signed download token (provided in webhook payloads) or a\nvalid session.\n",
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "downloadRawEmail",
    "path": "/emails/{id}/raw",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [
      {
        "description": "Signed download token from webhook payload",
        "name": "token",
        "required": false,
        "type": "string"
      }
    ],
    "sdkName": "downloadRawEmail",
    "summary": "Download raw email",
    "tag": "Emails",
    "tagCommand": "emails"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "get-email",
    "description": null,
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "getEmail",
    "path": "/emails/{id}",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "getEmail",
    "summary": "Get email details",
    "tag": "Emails",
    "tagCommand": "emails"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "list-emails",
    "description": "Returns a paginated list of received emails. Supports filtering by\ndomain, status, date range, and free-text search across subject,\nsender, and recipient fields.\n",
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "listEmails",
    "path": "/emails",
    "pathParams": [],
    "queryParams": [
      {
        "description": "Pagination cursor from a previous response's `meta.cursor` field.\nFormat: `{ISO-datetime}|{id}`\n",
        "name": "cursor",
        "required": false,
        "type": "string"
      },
      {
        "description": "Number of results per page",
        "name": "limit",
        "required": false,
        "type": "integer"
      },
      {
        "description": "Filter by domain ID",
        "name": "domain_id",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter by email status",
        "name": "status",
        "required": false,
        "type": "string"
      },
      {
        "description": "Search subject, sender, and recipient (case-insensitive)",
        "name": "search",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter emails created on or after this timestamp",
        "name": "date_from",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter emails created on or before this timestamp",
        "name": "date_to",
        "required": false,
        "type": "string"
      }
    ],
    "sdkName": "listEmails",
    "summary": "List emails",
    "tag": "Emails",
    "tagCommand": "emails"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "replay-email-webhooks",
    "description": "Re-delivers the webhook payload for this email to all active\nendpoints matching the email's domain. Includes rate limiting\nto prevent stampeding.\n",
    "hasJsonBody": false,
    "method": "POST",
    "operationId": "replayEmailWebhooks",
    "path": "/emails/{id}/replay",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "replayEmailWebhooks",
    "summary": "Replay email webhooks",
    "tag": "Emails",
    "tagCommand": "emails"
  },
  {
    "binaryResponse": false,
    "bodyRequired": true,
    "command": "create-endpoint",
    "description": "Creates a new webhook endpoint. If a deactivated endpoint with the\nsame URL and domain exists, it is reactivated instead.\nSubject to plan limits on the number of active endpoints.\n",
    "hasJsonBody": true,
    "method": "POST",
    "operationId": "createEndpoint",
    "path": "/endpoints",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "createEndpoint",
    "summary": "Create a webhook endpoint",
    "tag": "Endpoints",
    "tagCommand": "endpoints"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "delete-endpoint",
    "description": "Soft-deletes a webhook endpoint. The endpoint will no longer\nreceive webhook deliveries.\n",
    "hasJsonBody": false,
    "method": "DELETE",
    "operationId": "deleteEndpoint",
    "path": "/endpoints/{id}",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "deleteEndpoint",
    "summary": "Delete a webhook endpoint",
    "tag": "Endpoints",
    "tagCommand": "endpoints"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "list-endpoints",
    "description": "Returns all active (non-deleted) webhook endpoints.",
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "listEndpoints",
    "path": "/endpoints",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "listEndpoints",
    "summary": "List webhook endpoints",
    "tag": "Endpoints",
    "tagCommand": "endpoints"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "test-endpoint",
    "description": "Sends a sample `email.received` event to the endpoint. The request\nincludes SSRF protection (private IP rejection and DNS pinning).\nRate limited to 4 per minute and 30 per hour (non-exempt).\nSuccessful deliveries and verified-domain endpoints are exempt\nfrom the rate limit.\n",
    "hasJsonBody": false,
    "method": "POST",
    "operationId": "testEndpoint",
    "path": "/endpoints/{id}/test",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "testEndpoint",
    "summary": "Send a test webhook",
    "tag": "Endpoints",
    "tagCommand": "endpoints"
  },
  {
    "binaryResponse": false,
    "bodyRequired": true,
    "command": "update-endpoint",
    "description": "Updates an active webhook endpoint. If the URL is changed, the old\nendpoint is deactivated and a new one is created (or an existing\ndeactivated endpoint with the new URL is reactivated).\n",
    "hasJsonBody": true,
    "method": "PATCH",
    "operationId": "updateEndpoint",
    "path": "/endpoints/{id}",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "updateEndpoint",
    "summary": "Update a webhook endpoint",
    "tag": "Endpoints",
    "tagCommand": "endpoints"
  },
  {
    "binaryResponse": false,
    "bodyRequired": true,
    "command": "create-filter",
    "description": "Creates a new whitelist or blocklist filter. Per-domain filters\nrequire a Pro plan. Patterns are stored as lowercase.\n",
    "hasJsonBody": true,
    "method": "POST",
    "operationId": "createFilter",
    "path": "/filters",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "createFilter",
    "summary": "Create a filter rule",
    "tag": "Filters",
    "tagCommand": "filters"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "delete-filter",
    "description": null,
    "hasJsonBody": false,
    "method": "DELETE",
    "operationId": "deleteFilter",
    "path": "/filters/{id}",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "deleteFilter",
    "summary": "Delete a filter rule",
    "tag": "Filters",
    "tagCommand": "filters"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "list-filters",
    "description": "Returns all whitelist and blocklist filter rules.",
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "listFilters",
    "path": "/filters",
    "pathParams": [],
    "queryParams": [],
    "sdkName": "listFilters",
    "summary": "List filter rules",
    "tag": "Filters",
    "tagCommand": "filters"
  },
  {
    "binaryResponse": false,
    "bodyRequired": true,
    "command": "update-filter",
    "description": "Toggle a filter's enabled state.",
    "hasJsonBody": true,
    "method": "PATCH",
    "operationId": "updateFilter",
    "path": "/filters/{id}",
    "pathParams": [
      {
        "description": "Resource UUID",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "updateFilter",
    "summary": "Update a filter rule",
    "tag": "Filters",
    "tagCommand": "filters"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "list-deliveries",
    "description": "Returns a paginated list of webhook delivery attempts. Each delivery\nincludes a nested `email` object with sender, recipient, and subject.\n",
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "listDeliveries",
    "path": "/webhooks/deliveries",
    "pathParams": [],
    "queryParams": [
      {
        "description": "Pagination cursor from a previous response's `meta.cursor` field.\nFormat: `{ISO-datetime}|{id}`\n",
        "name": "cursor",
        "required": false,
        "type": "string"
      },
      {
        "description": "Number of results per page",
        "name": "limit",
        "required": false,
        "type": "integer"
      },
      {
        "description": "Filter by email ID",
        "name": "email_id",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter by delivery status",
        "name": "status",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter deliveries created on or after this timestamp",
        "name": "date_from",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter deliveries created on or before this timestamp",
        "name": "date_to",
        "required": false,
        "type": "string"
      }
    ],
    "sdkName": "listDeliveries",
    "summary": "List webhook deliveries",
    "tag": "Webhook Deliveries",
    "tagCommand": "webhook-deliveries"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "replay-delivery",
    "description": "Re-sends the stored webhook payload from a previous delivery attempt.\nIf the original endpoint is still active, it is targeted. If the\noriginal endpoint was deleted, the first active endpoint is used.\nDeactivated endpoints cannot be replayed to.\n",
    "hasJsonBody": false,
    "method": "POST",
    "operationId": "replayDelivery",
    "path": "/webhooks/deliveries/{id}/replay",
    "pathParams": [
      {
        "description": "Delivery ID (numeric)",
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "sdkName": "replayDelivery",
    "summary": "Replay a webhook delivery",
    "tag": "Webhook Deliveries",
    "tagCommand": "webhook-deliveries"
  }
];
