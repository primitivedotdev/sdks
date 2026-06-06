#!/usr/bin/env node
/**
 * MCP Server generated from OpenAPI spec for -primitivedotdev-mcp v1.0.0
 * Generated on: 2026-06-06T22:21:40.254Z
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type CallToolResult,
  type CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";

import { z, ZodError } from 'zod';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import axios, { type AxiosRequestConfig, type AxiosError } from 'axios';

/**
 * Type definition for JSON objects
 */
type JsonObject = Record<string, any>;

/**
 * Interface for MCP Tool Definition
 */
interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: any;
    method: string;
    pathTemplate: string;
    executionParameters: { name: string, in: string }[];
    requestBodyContentType?: string;
    securityRequirements: any[];
}

/**
 * Server configuration
 */
export const SERVER_NAME = "@primitivedotdev/mcp";
export const SERVER_VERSION = "0.1.0";
// Base URL for the API, can be set via environment variable or determined from OpenAPI spec
export const API_BASE_URL = process.env.API_BASE_URL || "https://api.primitive.dev/v1";
console.error("API_BASE_URL is set to:", API_BASE_URL);

/**
 * MCP Server instance
 */
const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
);

/**
 * Map of tool definitions by name
 */
const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([

  ["getAccount", {
    name: "getAccount",
    description: `Get account info`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/account",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"BearerAuth":[]}]
  }],
  ["getInboxStatus", {
    name: "getInboxStatus",
    description: `Returns one consolidated view of inbound domain readiness,
webhook/function processing routes, deployed Functions, and
recent inbound email activity.

Agents should call this before guiding a user through inbound
setup. It answers the practical questions "can I receive mail",
"will anything process that mail", and "what should I do next"
without forcing clients to stitch together domains, endpoints,
functions, and emails manually.
`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/inbox/status",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"BearerAuth":[]}]
  }],
  ["listEmails", {
    name: "listEmails",
    description: `Returns a paginated list of INBOUND emails received at your
verified domains. Outbound messages sent via /send-mail are
not included; this endpoint is the inbox view, not a
unified send/receive history.

Supports filtering by domain, status, date range, and
free-text search across subject, sender, and recipient
fields.

For a compact text-table summary of the most recent N
inbounds (no filters, no cursor pagination), the CLI ships
\`primitive emails:latest\` as a one-line-per-email shortcut.
It's TTY-aware so id columns are full UUIDs when piped, and
a \`--json\` flag returns the same envelope this endpoint
does. Use whichever fits the call site.
`,
    inputSchema: {"type":"object","properties":{"cursor":{"type":"string","description":"Pagination cursor from a previous response's `meta.cursor` field.\nFormat: `{ISO-datetime}|{id}`\n"},"limit":{"type":"number","minimum":1,"maximum":100,"default":50,"description":"Number of results per page"},"domain_id":{"type":"string","format":"uuid","description":"Filter by domain ID"},"status":{"type":"string","description":"Filter inbound rows by lifecycle status. See `EmailStatus`\nfor what each value means. Note that the webhook delivery\nstate is a SEPARATE lifecycle on the same row; filter by\n`webhook_status` semantics is not currently supported on\nthis endpoint.\n","enum":["pending","accepted","completed","rejected"]},"search":{"type":"string","maxLength":500,"description":"Search subject, sender, and recipient (case-insensitive)"},"date_from":{"type":"string","format":"date-time","description":"Filter emails created on or after this timestamp"},"date_to":{"type":"string","format":"date-time","description":"Filter emails created on or before this timestamp"}}},
    method: "get",
    pathTemplate: "/emails",
    executionParameters: [{"name":"cursor","in":"query"},{"name":"limit","in":"query"},{"name":"domain_id","in":"query"},{"name":"status","in":"query"},{"name":"search","in":"query"},{"name":"date_from","in":"query"},{"name":"date_to","in":"query"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"BearerAuth":[]}]
  }],
  ["searchEmails", {
    name: "searchEmails",
    description: `Searches inbound emails with structured filters and optional
full-text matching across parsed email fields. This endpoint is
optimized for filtered inbox views and CLI polling workflows:
callers that only need new accepted mail can pass
\`sort=received_at_asc\`, \`snippet=false\`, \`include_facets=false\`,
and a \`date_from\` timestamp.

\`q\`, \`subject\`, and \`body\` use the same English full-text index
as the web inbox search. Structured filters such as \`from\`, \`to\`,
\`domain_id\`, status, attachment presence, and spam score bounds
are combined with the text query.
`,
    inputSchema: {"type":"object","properties":{"q":{"type":"string","maxLength":500,"description":"Full-text search DSL query."},"from":{"type":"string","maxLength":255,"description":"Filter by sender address or sender domain."},"to":{"type":"string","maxLength":255,"description":"Filter by recipient address or recipient domain."},"subject":{"type":"string","maxLength":500,"description":"Full-text search restricted to the subject field."},"body":{"type":"string","maxLength":2000,"description":"Full-text search restricted to the parsed text body."},"domain_id":{"type":"string","format":"uuid","description":"Filter by domain ID."},"reply_to_sent_email_id":{"type":"string","format":"uuid","description":"Filter to inbound emails that are replies to a specific\noutbound send. The value is a `sent_emails.id` (UUID). At\ninbound ingest, Primitive matches the parsed In-Reply-To\nheader (or References as a fallback) against\n`sent_emails.message_id` in the same org and records the\nresolved id on `emails.reply_to_sent_email_id`. This filter\nis the strict-threading lookup behind `primitive chat` and\nany UI that wants to show the inbound reply to a given\nsend. NULL on inbound that isn't a threaded reply to one\nof your sends, so existing emails received before this\ningestion landed will not match.\n"},"status":{"type":"string","description":"Filter by inbound email lifecycle status.","enum":["pending","accepted","completed","rejected"]},"date_from":{"type":"string","format":"date-time","description":"Filter emails received on or after this timestamp."},"date_to":{"type":"string","format":"date-time","description":"Filter emails received on or before this timestamp."},"has_attachment":{"type":"string","enum":["true","false"],"description":"Filter by whether the email has one or more attachments."},"spam_score_lt":{"type":"number","description":"Filter to emails with spam score below this value."},"spam_score_gte":{"type":"number","description":"Filter to emails with spam score greater than or equal to this value."},"sort":{"type":"string","enum":["relevance","received_at_desc","received_at_asc"],"description":"Sort mode. Defaults to relevance when a text query is present,\notherwise `received_at_desc`.\n"},"cursor":{"type":"string","maxLength":200,"description":"Opaque pagination cursor from a previous search response."},"limit":{"type":"number","minimum":1,"maximum":100,"default":50,"description":"Number of results per page"},"snippet":{"type":"string","enum":["true","false"],"default":"true","description":"Include subject/body highlight snippets when text search is active."},"include_facets":{"type":"string","enum":["true","false"],"default":"true","description":"Include facet counts for sender, domain, status, and attachment presence."}}},
    method: "get",
    pathTemplate: "/emails/search",
    executionParameters: [{"name":"q","in":"query"},{"name":"from","in":"query"},{"name":"to","in":"query"},{"name":"subject","in":"query"},{"name":"body","in":"query"},{"name":"domain_id","in":"query"},{"name":"reply_to_sent_email_id","in":"query"},{"name":"status","in":"query"},{"name":"date_from","in":"query"},{"name":"date_to","in":"query"},{"name":"has_attachment","in":"query"},{"name":"spam_score_lt","in":"query"},{"name":"spam_score_gte","in":"query"},{"name":"sort","in":"query"},{"name":"cursor","in":"query"},{"name":"limit","in":"query"},{"name":"snippet","in":"query"},{"name":"include_facets","in":"query"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"BearerAuth":[]}]
  }],
  ["getEmail", {
    name: "getEmail",
    description: `Returns the full record for an inbound email received at one
of your verified domains, including the parsed text and HTML
bodies, threading metadata, SMTP envelope detail, webhook
delivery state, and a \`replies\` array for any outbound sends
recorded as replies to this inbound.

For listing inbound emails (with cursor pagination, status
and date filters, and free-text search), use
\`/emails\`. Outbound (sent) email records are NOT returned
here; use \`/sent-emails/{id}\` for those.

The response carries four sender-shaped fields whose
meanings overlap. \`from_email\` is the canonical "who sent
this" field for most use cases (parsed bare address from
the \`From:\` header, with a \`sender\` fallback). \`from_header\`
is the raw header including any display name. \`sender\` and
\`smtp_mail_from\` both carry the SMTP envelope MAIL FROM
(return-path) and are equal by construction; \`sender\` is
the older field name retained for compatibility. See
\`primitive describe emails:get-email | jq '.responseSchema.properties'\`
for per-field detail.
`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Resource UUID"}},"required":["id"]},
    method: "get",
    pathTemplate: "/emails/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"BearerAuth":[]}]
  }],
  ["replyToEmail", {
    name: "replyToEmail",
    description: `Sends an outbound reply to the inbound email identified by \`id\`.
Threading headers (\`In-Reply-To\`, \`References\`), recipient
derivation (Reply-To, then From, then bare sender), and the
\`Re:\` subject prefix are all derived server-side from the
stored inbound row. The request body carries only the message
body, optional From override, optional attachments, and optional
\`wait\` flag; passing any header or recipient override is
rejected by the schema (\`additionalProperties: false\`).

Forwards through the same gates as \`/send-mail\`: the response
status, error envelope, and \`idempotent_replay\` flag mirror
the send-mail contract verbatim.
`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Resource UUID"},"requestBody":{"type":"object","additionalProperties":false,"description":"Body shape for `/emails/{id}/reply`. Intentionally narrow:\nrecipients (`to`), subject, and threading headers\n(`in_reply_to`, `references`) are derived server-side from\nthe inbound row referenced by the path id and are rejected by\n`additionalProperties` if passed (returns 400).\n\n`from` IS allowed because of legitimate use cases (display-name\naddition, replying from a different verified outbound address,\nmulti-team triage). Send-mail's per-send `canSendFrom` gate\nvalidates the from-domain regardless, so the override carries\nno extra privilege.\n","properties":{"body_text":{"type":"string","description":"Plain-text reply body. At least one of body_text or body_html is required. The combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes (same cap as send-mail)."},"body_html":{"type":"string","description":"HTML reply body. At least one of body_text or body_html is required."},"from":{"type":"string","minLength":3,"maxLength":998,"description":"Optional override for the reply's From header. Defaults to\nthe inbound's recipient. Use to add a display name (`\"Acme\nSupport\" <agent@company.com>`) or to reply from a different\nverified outbound address (e.g. multi-team routing where\nsupport@ triages to billing@). The from-domain must be a\nverified outbound domain for your org, same as send-mail.\n"},"wait":{"type":"boolean","description":"When true, wait for the first downstream SMTP delivery outcome before returning, mirroring the send-mail `wait` semantics."},"attachments":{"type":"array","maxItems":100,"description":"Inline attachments for this reply. Use https://api.primitive.dev/v1 for replies with attachments. Combined raw decoded attachment bytes must be at most 31457280.","items":{"type":"object","additionalProperties":false,"properties":{"filename":{"type":"string","minLength":1,"maxLength":255,"description":"Attachment filename. Control characters are rejected."},"content_type":{"type":"string","minLength":1,"maxLength":255,"description":"Optional MIME content type. Control characters are rejected."},"content_base64":{"type":"string","minLength":1,"maxLength":44040192,"description":"Base64-encoded attachment bytes."}},"required":["filename","content_base64"]}}}}},"required":["id","requestBody"]},
    method: "post",
    pathTemplate: "/emails/{id}/reply",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: "application/json",
    securityRequirements: [{"BearerAuth":[]}]
  }],
  ["sendEmail", {
    name: "sendEmail",
    description: `Sends an outbound email through Primitive's outbound relay. By default
the request returns once the relay accepts the message for delivery.
Set \`wait: true\` to wait for the first downstream SMTP delivery outcome.

**Host routing.** /send-mail is served by the canonical API host
(\`https://api.primitive.dev/v1\`) so the request body can carry
inline attachments up to ~30 MiB raw. The legacy dashboard
compatibility host (\`https://www.primitive.dev/api/v1\`) also accepts
/send-mail, but Vercel request body limits apply before proxying.
The typed SDKs route /send-mail to the canonical API host
automatically.
`,
    inputSchema: {"type":"object","properties":{"Idempotency-Key":{"type":"string","minLength":1,"maxLength":255,"pattern":"^[\\x21-\\x7E]+$","description":"Optional customer-supplied idempotency key. If omitted, Primitive\nderives one from the canonical request payload and echoes the\neffective value in the `Idempotency-Key` response header.\n"},"requestBody":{"type":"object","additionalProperties":false,"properties":{"from":{"type":"string","minLength":3,"maxLength":998,"description":"RFC 5322 From header. The sender domain must be a verified outbound domain for your organization."},"to":{"type":"string","minLength":3,"maxLength":320,"description":"Recipient address. Recipient eligibility depends on your account's outbound entitlements."},"subject":{"type":"string","minLength":1,"maxLength":998,"description":"Subject line for the outbound message"},"body_text":{"type":"string","description":"Plain-text message body. At least one of body_text or body_html is required. The combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes."},"body_html":{"type":"string","description":"HTML message body. At least one of body_text or body_html is required. The combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes."},"in_reply_to":{"type":"string","minLength":1,"maxLength":998,"pattern":"^[^\\x00-\\x1F\\x7F]+$","description":"Message-ID of the direct parent email when sending a threaded reply."},"references":{"type":"array","maxItems":100,"description":"Full ordered message-id chain for the thread.","items":{"type":"string","minLength":1,"maxLength":998,"pattern":"^[^\\x00-\\x1F\\x7F]+$"}},"attachments":{"type":"array","maxItems":100,"description":"Inline attachments. Send requests with attachments to https://api.primitive.dev/v1/send-mail. Combined raw decoded attachment bytes must be at most 31457280.","items":{"type":"object","additionalProperties":false,"properties":{"filename":{"type":"string","minLength":1,"maxLength":255,"description":"Attachment filename. Control characters are rejected."},"content_type":{"type":"string","minLength":1,"maxLength":255,"description":"Optional MIME content type. Control characters are rejected."},"content_base64":{"type":"string","minLength":1,"maxLength":44040192,"description":"Base64-encoded attachment bytes."}},"required":["filename","content_base64"]}},"wait":{"type":"boolean","description":"When true, wait for the first downstream SMTP delivery outcome before returning."},"wait_timeout_ms":{"type":"number","minimum":1000,"maximum":30000,"description":"Maximum time to wait for a delivery outcome when wait is true. Defaults to 30000."}},"required":["from","to","subject"],"description":"The JSON request body."}},"required":["requestBody"]},
    method: "post",
    pathTemplate: "/send-mail",
    executionParameters: [{"name":"Idempotency-Key","in":"header"}],
    requestBodyContentType: "application/json",
    securityRequirements: [{"BearerAuth":[]}]
  }],
]);

/**
 * Security schemes from the OpenAPI spec
 */
const securitySchemes =   {
    "BearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "description": "API key with `prim_` prefix: `Authorization: Bearer prim_<key>`"
    },
    "DownloadToken": {
      "type": "apiKey",
      "in": "query",
      "name": "token",
      "description": "Signed download token provided in webhook payloads"
    }
  };


server.setRequestHandler(ListToolsRequestSchema, async () => {
  const toolsForClient: Tool[] = Array.from(toolDefinitionMap.values()).map(def => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema
  }));
  return { tools: toolsForClient };
});


server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
  const { name: toolName, arguments: toolArgs } = request.params;
  const toolDefinition = toolDefinitionMap.get(toolName);
  if (!toolDefinition) {
    console.error(`Error: Unknown tool requested: ${toolName}`);
    return { content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }] };
  }
  return await executeApiTool(toolName, toolDefinition, toolArgs ?? {}, securitySchemes);
});



/**
 * Type definition for cached OAuth tokens
 */
interface TokenCacheEntry {
    token: string;
    expiresAt: number;
}

/**
 * Declare global __oauthTokenCache property for TypeScript
 */
declare global {
    var __oauthTokenCache: Record<string, TokenCacheEntry> | undefined;
}

/**
 * Acquires an OAuth2 token using client credentials flow
 * 
 * @param schemeName Name of the security scheme
 * @param scheme OAuth2 security scheme
 * @returns Acquired token or null if unable to acquire
 */
async function acquireOAuth2Token(schemeName: string, scheme: any): Promise<string | null | undefined> {
    try {
        // Check if we have the necessary credentials
        const clientId = process.env[`OAUTH_CLIENT_ID_SCHEMENAME`];
        const clientSecret = process.env[`OAUTH_CLIENT_SECRET_SCHEMENAME`];
        const scopes = process.env[`OAUTH_SCOPES_SCHEMENAME`];
        
        if (!clientId || !clientSecret) {
            console.error(`Missing client credentials for OAuth2 scheme '${schemeName}'`);
            return null;
        }
        
        // Initialize token cache if needed
        if (typeof global.__oauthTokenCache === 'undefined') {
            global.__oauthTokenCache = {};
        }
        
        // Check if we have a cached token
        const cacheKey = `${schemeName}_${clientId}`;
        const cachedToken = global.__oauthTokenCache[cacheKey];
        const now = Date.now();
        
        if (cachedToken && cachedToken.expiresAt > now) {
            console.error(`Using cached OAuth2 token for '${schemeName}' (expires in ${Math.floor((cachedToken.expiresAt - now) / 1000)} seconds)`);
            return cachedToken.token;
        }
        
        // Determine token URL based on flow type
        let tokenUrl = '';
        if (scheme.flows?.clientCredentials?.tokenUrl) {
            tokenUrl = scheme.flows.clientCredentials.tokenUrl;
            console.error(`Using client credentials flow for '${schemeName}'`);
        } else if (scheme.flows?.password?.tokenUrl) {
            tokenUrl = scheme.flows.password.tokenUrl;
            console.error(`Using password flow for '${schemeName}'`);
        } else {
            console.error(`No supported OAuth2 flow found for '${schemeName}'`);
            return null;
        }
        
        // Prepare the token request
        let formData = new URLSearchParams();
        formData.append('grant_type', 'client_credentials');
        
        // Add scopes if specified
        if (scopes) {
            formData.append('scope', scopes);
        }
        
        console.error(`Requesting OAuth2 token from ${tokenUrl}`);
        
        // Make the token request
        const response = await axios({
            method: 'POST',
            url: tokenUrl,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            data: formData.toString()
        });
        
        // Process the response
        if (response.data?.access_token) {
            const token = response.data.access_token;
            const expiresIn = response.data.expires_in || 3600; // Default to 1 hour
            
            // Cache the token
            global.__oauthTokenCache[cacheKey] = {
                token,
                expiresAt: now + (expiresIn * 1000) - 60000 // Expire 1 minute early
            };
            
            console.error(`Successfully acquired OAuth2 token for '${schemeName}' (expires in ${expiresIn} seconds)`);
            return token;
        } else {
            console.error(`Failed to acquire OAuth2 token for '${schemeName}': No access_token in response`);
            return null;
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error acquiring OAuth2 token for '${schemeName}':`, errorMessage);
        return null;
    }
}


/**
 * Executes an API tool with the provided arguments
 * 
 * @param toolName Name of the tool to execute
 * @param definition Tool definition
 * @param toolArgs Arguments provided by the user
 * @param allSecuritySchemes Security schemes from the OpenAPI spec
 * @returns Call tool result
 */
async function executeApiTool(
    toolName: string,
    definition: McpToolDefinition,
    toolArgs: JsonObject,
    allSecuritySchemes: Record<string, any>
): Promise<CallToolResult> {
  try {
    // Validate arguments against the input schema
    let validatedArgs: JsonObject;
    try {
        const zodSchema = getZodSchemaFromJsonSchema(definition.inputSchema, toolName);
        const argsToParse = (typeof toolArgs === 'object' && toolArgs !== null) ? toolArgs : {};
        validatedArgs = zodSchema.parse(argsToParse);
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            const validationErrorMessage = `Invalid arguments for tool '${toolName}': ${error.errors.map(e => `${e.path.join('.')} (${e.code}): ${e.message}`).join(', ')}`;
            return { content: [{ type: 'text', text: validationErrorMessage }] };
        } else {
             const errorMessage = error instanceof Error ? error.message : String(error);
             return { content: [{ type: 'text', text: `Internal error during validation setup: ${errorMessage}` }] };
        }
    }

    // Prepare URL, query parameters, headers, and request body
    let urlPath = definition.pathTemplate;
    const queryParams: Record<string, any> = {};
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    let requestBodyData: any = undefined;

    // Apply parameters to the URL path, query, or headers
    definition.executionParameters.forEach((param) => {
        const value = validatedArgs[param.name];
        if (typeof value !== 'undefined' && value !== null) {
            if (param.in === 'path') {
                urlPath = urlPath.replace(`{${param.name}}`, encodeURIComponent(String(value)));
            }
            else if (param.in === 'query') {
                queryParams[param.name] = value;
            }
            else if (param.in === 'header') {
                headers[param.name.toLowerCase()] = String(value);
            }
        }
    });

    // Ensure all path parameters are resolved
    if (urlPath.includes('{')) {
        throw new Error(`Failed to resolve path parameters: ${urlPath}`);
    }
    
    // Construct the full URL
    const requestUrl = API_BASE_URL ? `${API_BASE_URL}${urlPath}` : urlPath;

    // Handle request body if needed
    if (definition.requestBodyContentType && typeof validatedArgs['requestBody'] !== 'undefined') {
        requestBodyData = validatedArgs['requestBody'];
        headers['content-type'] = definition.requestBodyContentType;
    }


    // Apply security requirements if available
    // Security requirements use OR between array items and AND within each object
    const appliedSecurity = definition.securityRequirements?.find(req => {
        // Try each security requirement (combined with OR)
        return Object.entries(req).every(([schemeName, scopesArray]) => {
            const scheme = allSecuritySchemes[schemeName];
            if (!scheme) return false;
            
            // API Key security (header, query, cookie)
            if (scheme.type === 'apiKey') {
                return !!process.env[`API_KEY_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
            }
            
            // HTTP security (basic, bearer)
            if (scheme.type === 'http') {
                if (scheme.scheme?.toLowerCase() === 'bearer') {
                    return !!process.env[`BEARER_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                }
                else if (scheme.scheme?.toLowerCase() === 'basic') {
                    return !!process.env[`BASIC_USERNAME_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`] && 
                           !!process.env[`BASIC_PASSWORD_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                }
            }
            
            // OAuth2 security
            if (scheme.type === 'oauth2') {
                // Check for pre-existing token
                if (process.env[`OAUTH_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`]) {
                    return true;
                }
                
                // Check for client credentials for auto-acquisition
                if (process.env[`OAUTH_CLIENT_ID_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`] &&
                    process.env[`OAUTH_CLIENT_SECRET_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`]) {
                    // Verify we have a supported flow
                    if (scheme.flows?.clientCredentials || scheme.flows?.password) {
                        return true;
                    }
                }
                
                return false;
            }
            
            // OpenID Connect
            if (scheme.type === 'openIdConnect') {
                return !!process.env[`OPENID_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
            }
            
            return false;
        });
    });

    // If we found matching security scheme(s), apply them
    if (appliedSecurity) {
        // Apply each security scheme from this requirement (combined with AND)
        for (const [schemeName, scopesArray] of Object.entries(appliedSecurity)) {
            const scheme = allSecuritySchemes[schemeName];
            
            // API Key security
            if (scheme?.type === 'apiKey') {
                const apiKey = process.env[`API_KEY_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                if (apiKey) {
                    if (scheme.in === 'header') {
                        headers[scheme.name.toLowerCase()] = apiKey;
                        console.error(`Applied API key '${schemeName}' in header '${scheme.name}'`);
                    }
                    else if (scheme.in === 'query') {
                        queryParams[scheme.name] = apiKey;
                        console.error(`Applied API key '${schemeName}' in query parameter '${scheme.name}'`);
                    }
                    else if (scheme.in === 'cookie') {
                        // Add the cookie, preserving other cookies if they exist
                        headers['cookie'] = `${scheme.name}=${apiKey}${headers['cookie'] ? `; ${headers['cookie']}` : ''}`;
                        console.error(`Applied API key '${schemeName}' in cookie '${scheme.name}'`);
                    }
                }
            } 
            // HTTP security (Bearer or Basic)
            else if (scheme?.type === 'http') {
                if (scheme.scheme?.toLowerCase() === 'bearer') {
                    const token = process.env[`BEARER_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                    if (token) {
                        headers['authorization'] = `Bearer ${token}`;
                        console.error(`Applied Bearer token for '${schemeName}'`);
                    }
                } 
                else if (scheme.scheme?.toLowerCase() === 'basic') {
                    const username = process.env[`BASIC_USERNAME_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                    const password = process.env[`BASIC_PASSWORD_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                    if (username && password) {
                        headers['authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
                        console.error(`Applied Basic authentication for '${schemeName}'`);
                    }
                }
            }
            // OAuth2 security
            else if (scheme?.type === 'oauth2') {
                // First try to use a pre-provided token
                let token = process.env[`OAUTH_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                
                // If no token but we have client credentials, try to acquire a token
                if (!token && (scheme.flows?.clientCredentials || scheme.flows?.password)) {
                    console.error(`Attempting to acquire OAuth token for '${schemeName}'`);
                    token = (await acquireOAuth2Token(schemeName, scheme)) ?? '';
                }
                
                // Apply token if available
                if (token) {
                    headers['authorization'] = `Bearer ${token}`;
                    console.error(`Applied OAuth2 token for '${schemeName}'`);
                    
                    // List the scopes that were requested, if any
                    const scopes = scopesArray as string[];
                    if (scopes && scopes.length > 0) {
                        console.error(`Requested scopes: ${scopes.join(', ')}`);
                    }
                }
            }
            // OpenID Connect
            else if (scheme?.type === 'openIdConnect') {
                const token = process.env[`OPENID_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                if (token) {
                    headers['authorization'] = `Bearer ${token}`;
                    console.error(`Applied OpenID Connect token for '${schemeName}'`);
                    
                    // List the scopes that were requested, if any
                    const scopes = scopesArray as string[];
                    if (scopes && scopes.length > 0) {
                        console.error(`Requested scopes: ${scopes.join(', ')}`);
                    }
                }
            }
        }
    } 
    // Log warning if security is required but not available
    else if (definition.securityRequirements?.length > 0) {
        // First generate a more readable representation of the security requirements
        const securityRequirementsString = definition.securityRequirements
            .map(req => {
                const parts = Object.entries(req)
                    .map(([name, scopesArray]) => {
                        const scopes = scopesArray as string[];
                        if (scopes.length === 0) return name;
                        return `${name} (scopes: ${scopes.join(', ')})`;
                    })
                    .join(' AND ');
                return `[${parts}]`;
            })
            .join(' OR ');
            
        console.warn(`Tool '${toolName}' requires security: ${securityRequirementsString}, but no suitable credentials found.`);
    }
    

    // Prepare the axios request configuration
    const config: AxiosRequestConfig = {
      method: definition.method.toUpperCase(), 
      url: requestUrl, 
      params: queryParams, 
      headers: headers,
      ...(requestBodyData !== undefined && { data: requestBodyData }),
    };

    // Log request info to stderr (doesn't affect MCP output)
    console.error(`Executing tool "${toolName}": ${config.method} ${config.url}`);
    
    // Execute the request
    const response = await axios(config);

    // Process and format the response
    let responseText = '';
    const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
    
    // Handle JSON responses
    if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
         try { 
             responseText = JSON.stringify(response.data, null, 2); 
         } catch (e) { 
             responseText = "[Stringify Error]"; 
         }
    } 
    // Handle string responses
    else if (typeof response.data === 'string') { 
         responseText = response.data; 
    }
    // Handle other response types
    else if (response.data !== undefined && response.data !== null) { 
         responseText = String(response.data); 
    }
    // Handle empty responses
    else { 
         responseText = `(Status: ${response.status} - No body content)`; 
    }
    
    // Return formatted response
    return { 
        content: [ 
            { 
                type: "text", 
                text: `API Response (Status: ${response.status}):\n${responseText}` 
            } 
        ], 
    };

  } catch (error: unknown) {
    // Handle errors during execution
    let errorMessage: string;
    
    // Format Axios errors specially
    if (axios.isAxiosError(error)) { 
        errorMessage = formatApiError(error); 
    }
    // Handle standard errors
    else if (error instanceof Error) { 
        errorMessage = error.message; 
    }
    // Handle unexpected error types
    else { 
        errorMessage = 'Unexpected error: ' + String(error); 
    }
    
    // Log error to stderr
    console.error(`Error during execution of tool '${toolName}':`, errorMessage);
    
    // Return error message to client
    return { content: [{ type: "text", text: errorMessage }] };
  }
}


/**
 * Main function to start the server
 */
async function main() {
// Set up stdio transport
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`${SERVER_NAME} MCP Server (v${SERVER_VERSION}) running on stdio${API_BASE_URL ? `, proxying API at ${API_BASE_URL}` : ''}`);
  } catch (error) {
    console.error("Error during server startup:", error);
    process.exit(1);
  }
}

/**
 * Cleanup function for graceful shutdown
 */
async function cleanup() {
    console.error("Shutting down MCP server...");
    process.exit(0);
}

// Register signal handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start the server
main().catch((error) => {
  console.error("Fatal error in main execution:", error);
  process.exit(1);
});

/**
 * Formats API errors for better readability
 * 
 * @param error Axios error
 * @returns Formatted error message
 */
function formatApiError(error: AxiosError): string {
    let message = 'API request failed.';
    if (error.response) {
        message = `API Error: Status ${error.response.status} (${error.response.statusText || 'Status text not available'}). `;
        const responseData = error.response.data;
        const MAX_LEN = 200;
        if (typeof responseData === 'string') { 
            message += `Response: ${responseData.substring(0, MAX_LEN)}${responseData.length > MAX_LEN ? '...' : ''}`; 
        }
        else if (responseData) { 
            try { 
                const jsonString = JSON.stringify(responseData); 
                message += `Response: ${jsonString.substring(0, MAX_LEN)}${jsonString.length > MAX_LEN ? '...' : ''}`; 
            } catch { 
                message += 'Response: [Could not serialize data]'; 
            } 
        }
        else { 
            message += 'No response body received.'; 
        }
    } else if (error.request) {
        message = 'API Network Error: No response received from server.';
        if (error.code) message += ` (Code: ${error.code})`;
    } else { 
        message += `API Request Setup Error: ${error.message}`; 
    }
    return message;
}

/**
 * Converts a JSON Schema to a Zod schema for runtime validation
 * 
 * @param jsonSchema JSON Schema
 * @param toolName Tool name for error reporting
 * @returns Zod schema
 */
function getZodSchemaFromJsonSchema(jsonSchema: any, toolName: string): z.ZodTypeAny {
    if (typeof jsonSchema !== 'object' || jsonSchema === null) { 
        return z.object({}).passthrough(); 
    }
    try {
        const zodSchemaString = jsonSchemaToZod(jsonSchema);
        const zodSchema = eval(zodSchemaString);
        if (typeof zodSchema?.parse !== 'function') { 
            throw new Error('Eval did not produce a valid Zod schema.'); 
        }
        return zodSchema as z.ZodTypeAny;
    } catch (err: any) {
        console.error(`Failed to generate/evaluate Zod schema for '${toolName}':`, err);
        return z.object({}).passthrough();
    }
}
