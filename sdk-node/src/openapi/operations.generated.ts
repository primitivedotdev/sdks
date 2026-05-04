/**
 * Generated operation metadata for the Primitive API CLI and SDK tooling.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run `pnpm generate:openapi` to regenerate.
 */

export type PrimitiveParameterManifest = {
  description: string | null;
  enum: string[] | null;
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
  /**
   * Resolved JSON Schema for the request body when `hasJsonBody` is
   * true. `$ref`s into the OpenAPI components are inlined.
   */
  requestSchema: Record<string, unknown> | null;
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
    "requestSchema": null,
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
    "requestSchema": null,
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
    "requestSchema": null,
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
    "requestSchema": null,
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
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "spam_threshold": {
          "type": [
            "number",
            "null"
          ],
          "minimum": 0,
          "maximum": 15,
          "description": "Global spam score threshold (0-15). Emails scoring above this are rejected. Set to null to disable."
        },
        "discard_content_on_webhook_confirmed": {
          "type": "boolean",
          "description": "Whether to discard email content after the webhook endpoint confirms receipt."
        }
      },
      "minProperties": 1
    },
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
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "domain": {
          "type": "string",
          "minLength": 1,
          "maxLength": 253,
          "description": "The domain name to claim (e.g. \"example.com\")"
        }
      },
      "required": [
        "domain"
      ]
    },
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": null,
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
    "requestSchema": null,
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "is_active": {
          "type": "boolean",
          "description": "Whether the domain accepts incoming emails"
        },
        "spam_threshold": {
          "type": [
            "number",
            "null"
          ],
          "minimum": 0,
          "maximum": 15,
          "description": "Per-domain spam threshold override (Pro plan required)"
        }
      },
      "minProperties": 1
    },
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": null,
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": null,
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [
      {
        "description": "Signed download token from webhook payload",
        "enum": null,
        "name": "token",
        "required": false,
        "type": "string"
      }
    ],
    "requestSchema": null,
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [
      {
        "description": "Signed download token from webhook payload",
        "enum": null,
        "name": "token",
        "required": false,
        "type": "string"
      }
    ],
    "requestSchema": null,
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": null,
    "sdkName": "getEmail",
    "summary": "Get email details",
    "tag": "Emails",
    "tagCommand": "emails"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "list-emails",
    "description": "Returns a paginated list of INBOUND emails received at your\nverified domains. Outbound messages sent via /send-mail are not\nincluded; this endpoint is the inbox view, not a unified\nsend/receive history.\n\nSupports filtering by domain, status, date range, and free-text\nsearch across subject, sender, and recipient fields.\n",
    "hasJsonBody": false,
    "method": "GET",
    "operationId": "listEmails",
    "path": "/emails",
    "pathParams": [],
    "queryParams": [
      {
        "description": "Pagination cursor from a previous response's `meta.cursor` field.\nFormat: `{ISO-datetime}|{id}`\n",
        "enum": null,
        "name": "cursor",
        "required": false,
        "type": "string"
      },
      {
        "description": "Number of results per page",
        "enum": null,
        "name": "limit",
        "required": false,
        "type": "integer"
      },
      {
        "description": "Filter by domain ID",
        "enum": null,
        "name": "domain_id",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter by email status",
        "enum": [
          "pending",
          "accepted",
          "completed",
          "rejected"
        ],
        "name": "status",
        "required": false,
        "type": "string"
      },
      {
        "description": "Search subject, sender, and recipient (case-insensitive)",
        "enum": null,
        "name": "search",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter emails created on or after this timestamp",
        "enum": null,
        "name": "date_from",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter emails created on or before this timestamp",
        "enum": null,
        "name": "date_to",
        "required": false,
        "type": "string"
      }
    ],
    "requestSchema": null,
    "sdkName": "listEmails",
    "summary": "List inbound emails",
    "tag": "Emails",
    "tagCommand": "emails"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "replay-email-webhooks",
    "description": "Re-delivers the webhook payload for this email to all active\nendpoints matching the email's domain. Rate limited per-email\n(short cooldown between successive replays of the same email)\nand per-org (burst + sustained windows), sharing an org-wide\nbudget with delivery replays.\n",
    "hasJsonBody": false,
    "method": "POST",
    "operationId": "replayEmailWebhooks",
    "path": "/emails/{id}/replay",
    "pathParams": [
      {
        "description": "Resource UUID",
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": null,
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
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "url": {
          "type": "string",
          "minLength": 1,
          "description": "The webhook URL to deliver events to"
        },
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Whether the endpoint is active"
        },
        "domain_id": {
          "type": [
            "string",
            "null"
          ],
          "format": "uuid",
          "description": "Restrict to emails from a specific domain"
        },
        "rules": {
          "type": "object",
          "description": "Endpoint-specific filtering rules"
        }
      },
      "required": [
        "url"
      ]
    },
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": null,
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
    "requestSchema": null,
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": null,
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "url": {
          "type": "string",
          "minLength": 1,
          "description": "New webhook URL (triggers endpoint rotation)"
        },
        "enabled": {
          "type": "boolean"
        },
        "domain_id": {
          "type": [
            "string",
            "null"
          ],
          "format": "uuid"
        },
        "rules": {
          "type": "object"
        }
      },
      "minProperties": 1
    },
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
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "whitelist",
            "blocklist"
          ]
        },
        "pattern": {
          "type": "string",
          "minLength": 1,
          "maxLength": 500,
          "description": "Email address or pattern to filter"
        },
        "domain_id": {
          "type": [
            "string",
            "null"
          ],
          "format": "uuid",
          "description": "Restrict filter to a specific domain (Pro plan required)"
        }
      },
      "required": [
        "type",
        "pattern"
      ]
    },
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": null,
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
    "requestSchema": null,
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
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "enabled": {
          "type": "boolean"
        }
      },
      "required": [
        "enabled"
      ]
    },
    "sdkName": "updateFilter",
    "summary": "Update a filter rule",
    "tag": "Filters",
    "tagCommand": "filters"
  },
  {
    "binaryResponse": false,
    "bodyRequired": true,
    "command": "reply-to-email",
    "description": "Sends an outbound reply to the inbound email identified by `id`.\nThreading headers (`In-Reply-To`, `References`), recipient\nderivation (Reply-To, then From, then bare sender), and the\n`Re:` subject prefix are all derived server-side from the\nstored inbound row. The request body carries only the message\nbody and optional `wait` flag; passing any header or recipient\noverride is rejected by the schema (`additionalProperties:\nfalse`).\n\nForwards through the same gates as `/send-mail`: the response\nstatus, error envelope, and `idempotent_replay` flag mirror\nthe send-mail contract verbatim.\n",
    "hasJsonBody": true,
    "method": "POST",
    "operationId": "replyToEmail",
    "path": "/emails/{id}/reply",
    "pathParams": [
      {
        "description": "Resource UUID",
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "description": "Body shape for `/emails/{id}/reply`. Intentionally narrow:\nrecipients (`to`), subject, and threading headers\n(`in_reply_to`, `references`) are derived server-side from\nthe inbound row referenced by the path id and are rejected by\n`additionalProperties` if passed (returns 400).\n\n`from` IS allowed because of legitimate use cases (display-name\naddition, replying from a different verified outbound address,\nmulti-team triage). Send-mail's per-send `canSendFrom` gate\nvalidates the from-domain regardless, so the override carries\nno extra privilege.\n",
      "properties": {
        "body_text": {
          "type": "string",
          "description": "Plain-text reply body. At least one of body_text or body_html is required. The combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes (same cap as send-mail)."
        },
        "body_html": {
          "type": "string",
          "description": "HTML reply body. At least one of body_text or body_html is required."
        },
        "from": {
          "type": "string",
          "minLength": 3,
          "maxLength": 998,
          "description": "Optional override for the reply's From header. Defaults to\nthe inbound's recipient. Use to add a display name (`\"Acme\nSupport\" <agent@company.com>`) or to reply from a different\nverified outbound address (e.g. multi-team routing where\nsupport@ triages to billing@). The from-domain must be a\nverified outbound domain for your org, same as send-mail.\n"
        },
        "wait": {
          "type": "boolean",
          "description": "When true, wait for the first downstream SMTP delivery outcome before returning, mirroring the send-mail `wait` semantics."
        }
      }
    },
    "sdkName": "replyToEmail",
    "summary": "Reply to an inbound email",
    "tag": "Sending",
    "tagCommand": "sending"
  },
  {
    "binaryResponse": false,
    "bodyRequired": true,
    "command": "send-email",
    "description": "Sends an outbound email through Primitive's outbound relay. By default\nthe request returns once the relay accepts the message for delivery.\nSet `wait: true` to wait for the first downstream SMTP delivery outcome.\n",
    "hasJsonBody": true,
    "method": "POST",
    "operationId": "sendEmail",
    "path": "/send-mail",
    "pathParams": [],
    "queryParams": [],
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "from": {
          "type": "string",
          "minLength": 3,
          "maxLength": 998,
          "description": "RFC 5322 From header. The sender domain must be a verified outbound domain for your organization."
        },
        "to": {
          "type": "string",
          "minLength": 3,
          "maxLength": 320,
          "description": "Recipient address. Recipient eligibility depends on your account's outbound entitlements."
        },
        "subject": {
          "type": "string",
          "minLength": 1,
          "maxLength": 998,
          "description": "Subject line for the outbound message"
        },
        "body_text": {
          "type": "string",
          "description": "Plain-text message body. At least one of body_text or body_html is required. The combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes."
        },
        "body_html": {
          "type": "string",
          "description": "HTML message body. At least one of body_text or body_html is required. The combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes."
        },
        "in_reply_to": {
          "type": "string",
          "minLength": 1,
          "maxLength": 998,
          "pattern": "^[^\\x00-\\x1F\\x7F]+$",
          "description": "Message-ID of the direct parent email when sending a threaded reply."
        },
        "references": {
          "type": "array",
          "maxItems": 100,
          "description": "Full ordered message-id chain for the thread.",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 998,
            "pattern": "^[^\\x00-\\x1F\\x7F]+$"
          }
        },
        "wait": {
          "type": "boolean",
          "description": "When true, wait for the first downstream SMTP delivery outcome before returning."
        },
        "wait_timeout_ms": {
          "type": "integer",
          "minimum": 1000,
          "maximum": 30000,
          "description": "Maximum time to wait for a delivery outcome when wait is true. Defaults to 30000."
        }
      },
      "required": [
        "from",
        "to",
        "subject"
      ]
    },
    "sdkName": "sendEmail",
    "summary": "Send outbound email",
    "tag": "Sending",
    "tagCommand": "sending"
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
        "enum": null,
        "name": "cursor",
        "required": false,
        "type": "string"
      },
      {
        "description": "Number of results per page",
        "enum": null,
        "name": "limit",
        "required": false,
        "type": "integer"
      },
      {
        "description": "Filter by email ID",
        "enum": null,
        "name": "email_id",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter by delivery status",
        "enum": [
          "pending",
          "delivered",
          "header_confirmed",
          "failed"
        ],
        "name": "status",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter deliveries created on or after this timestamp",
        "enum": null,
        "name": "date_from",
        "required": false,
        "type": "string"
      },
      {
        "description": "Filter deliveries created on or before this timestamp",
        "enum": null,
        "name": "date_to",
        "required": false,
        "type": "string"
      }
    ],
    "requestSchema": null,
    "sdkName": "listDeliveries",
    "summary": "List webhook deliveries",
    "tag": "Webhook Deliveries",
    "tagCommand": "webhook-deliveries"
  },
  {
    "binaryResponse": false,
    "bodyRequired": false,
    "command": "replay-delivery",
    "description": "Re-sends the stored webhook payload from a previous delivery attempt.\nIf the original endpoint is still active, it is targeted. If the\noriginal endpoint was deleted, the oldest active endpoint is used.\nDeactivated endpoints cannot be replayed to. Rate limited per-org,\nsharing an org-wide budget with email replays.\n",
    "hasJsonBody": false,
    "method": "POST",
    "operationId": "replayDelivery",
    "path": "/webhooks/deliveries/{id}/replay",
    "pathParams": [
      {
        "description": "Delivery ID (numeric)",
        "enum": null,
        "name": "id",
        "required": true,
        "type": "string"
      }
    ],
    "queryParams": [],
    "requestSchema": null,
    "sdkName": "replayDelivery",
    "summary": "Replay a webhook delivery",
    "tag": "Webhook Deliveries",
    "tagCommand": "webhook-deliveries"
  }
];
