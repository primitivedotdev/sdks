/**
 * Permissions declared by the Primitive API, from the spec's
 * `x-primitive-permission` extension.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run `pnpm generate:openapi` to regenerate.
 */

/** Every permission an operation in this API version requires. */
export const PERMISSIONS = [
  "account:claim",
  "account:manage",
  "account:read",
  "agent_connections:manage",
  "agent_connections:update",
  "agent_contact_policy:read",
  "agent_contacts:manage",
  "agent_networks:admit",
  "agent_networks:manage",
  "agent_networks:read",
  "changes:read",
  "contacts:delete",
  "contacts:policy",
  "contacts:read",
  "contacts:write",
  "credential_events:read",
  "credentials:read",
  "credentials:revoke_self",
  "credits:read",
  "credits:redeem",
  "domains:manage",
  "domains:read",
  "endpoints.pull:manage",
  "endpoints:manage",
  "endpoints:pull",
  "filters:manage",
  "functions:deploy",
  "functions:manage",
  "functions:read",
  "keys:manage",
  "keys:read",
  "mail.raw:read",
  "mail.search:semantic",
  "mail.state:write",
  "mail:delete",
  "mail:read",
  "mail:reply",
  "mail:send",
  "mail:signal",
  "member_address:manage",
  "members:read",
  "memories:read",
  "memories:write",
  "routes:manage",
  "secrets:manage",
  "sent:cancel",
  "sent:manage",
  "templates:install",
  "wake:manage",
  "webhook_secret:manage",
  "webhook_secret:read",
  "webhooks:read",
  "webhooks:replay"
] as const;

/** A permission an operation can require, such as `mail:send`. */
export type Permission = (typeof PERMISSIONS)[number];

/** The permissions each operation requires, all of them, by operation id. */
export const OPERATION_PERMISSIONS: Readonly<Record<string, readonly Permission[]>> = {
  "addDefaultNetworkMember": [
    "agent_networks:manage"
  ],
  "addDomain": [
    "domains:manage"
  ],
  "awaitReply": [
    "mail:read"
  ],
  "cancelSentEmail": [
    "sent:manage"
  ],
  "cancelSentEmailByIdempotencyKey": [
    "sent:cancel"
  ],
  "checkDefaultNetworkContactAdmission": [
    "agent_networks:admit"
  ],
  "checkDomainDns": [
    "domains:read"
  ],
  "claimAgentConnection": [
    "agent_connections:update"
  ],
  "cliLogout": [
    "credentials:revoke_self"
  ],
  "completeWebhookEvent": [
    "endpoints:pull"
  ],
  "createAgentClaimLink": [
    "account:claim"
  ],
  "createAgentConnection": [
    "agent_connections:manage"
  ],
  "createEndpoint": [
    "endpoints.pull:manage"
  ],
  "createFilter": [
    "filters:manage"
  ],
  "createFunction": [
    "functions:deploy"
  ],
  "createFunctionSecret": [
    "secrets:manage"
  ],
  "createKey": [
    "keys:manage"
  ],
  "createOrgSecret": [
    "secrets:manage"
  ],
  "createRoute": [
    "routes:manage"
  ],
  "createWakeAuthorization": [
    "wake:manage"
  ],
  "createWakeSchedule": [
    "wake:manage"
  ],
  "deleteAgentContact": [
    "agent_contacts:manage"
  ],
  "deleteContact": [
    "contacts:delete"
  ],
  "deleteDomain": [
    "domains:manage"
  ],
  "deleteEmail": [
    "mail:delete"
  ],
  "deleteEndpoint": [
    "endpoints.pull:manage"
  ],
  "deleteFilter": [
    "filters:manage"
  ],
  "deleteFunction": [
    "functions:manage"
  ],
  "deleteFunctionSecret": [
    "secrets:manage"
  ],
  "deleteMemory": [
    "memories:write"
  ],
  "deleteOrgSecret": [
    "secrets:manage"
  ],
  "deleteRepeatingSend": [
    "sent:manage"
  ],
  "deleteRoute": [
    "routes:manage"
  ],
  "deleteSentEmail": [
    "sent:manage"
  ],
  "deleteWakeAuthorization": [
    "wake:manage"
  ],
  "deleteWakeSchedule": [
    "wake:manage"
  ],
  "discardEmailContent": [
    "mail.state:write"
  ],
  "downloadAttachments": [
    "mail:read"
  ],
  "downloadDomainZoneFile": [
    "domains:read"
  ],
  "downloadEmailAttachmentArchiveMember": [
    "mail:read"
  ],
  "downloadEmailAttachmentByFilename": [
    "mail:read"
  ],
  "downloadEmailAttachmentPart": [
    "mail:read"
  ],
  "downloadRawEmail": [
    "mail.raw:read"
  ],
  "downloadSentAttachmentArchiveMember": [
    "mail:read"
  ],
  "downloadSentAttachmentByFilename": [
    "mail:read"
  ],
  "downloadSentAttachmentPart": [
    "mail:read"
  ],
  "getAccessMode": [
    "members:read"
  ],
  "getAccount": [
    "account:read"
  ],
  "getAgentContactPolicy": [
    "agent_contact_policy:read"
  ],
  "getContact": [
    "contacts:read"
  ],
  "getContactPolicy": [
    "contacts:policy"
  ],
  "getConversation": [
    "mail:read"
  ],
  "getCredentialPolicy": [
    "credentials:read"
  ],
  "getCreditBalance": [
    "credits:read"
  ],
  "getDefaultNetworkAgent": [
    "agent_networks:read"
  ],
  "getEmail": [
    "mail:read"
  ],
  "getFunction": [
    "functions:read"
  ],
  "getFunctionRouting": [
    "functions:read"
  ],
  "getFunctionTestRunTrace": [
    "functions:manage"
  ],
  "getInboxStatus": [
    "account:read"
  ],
  "getKeyBuilder": [
    "keys:read"
  ],
  "getMemory": [
    "memories:read"
  ],
  "getOrgRoutingTopology": [
    "functions:read"
  ],
  "getOutboundStatus": [
    "account:read"
  ],
  "getRepeatingSend": [
    "sent:manage"
  ],
  "getSendPermissions": [
    "account:read"
  ],
  "getSentEmail": [
    "mail:read"
  ],
  "getStorageStats": [
    "account:read"
  ],
  "getTemplateInstall": [
    "functions:read"
  ],
  "getThread": [
    "mail:read"
  ],
  "getWakeSchedule": [
    "wake:manage"
  ],
  "getWebhookSecret": [
    "webhook_secret:read"
  ],
  "installTemplate": [
    "templates:install",
    "functions:deploy"
  ],
  "inviteAgentConnection": [
    "agent_connections:manage"
  ],
  "listAgentConnections": [
    "agent_connections:manage"
  ],
  "listAgentContacts": [
    "agent_contacts:manage"
  ],
  "listAgentNetworks": [
    "agent_networks:read"
  ],
  "listChanges": [
    "changes:read"
  ],
  "listContacts": [
    "contacts:read"
  ],
  "listCredentialEvents": [
    "credential_events:read"
  ],
  "listCredentials": [
    "credentials:read"
  ],
  "listDefaultNetworkAgents": [
    "agent_networks:read"
  ],
  "listDefaultNetworkMembers": [
    "agent_networks:manage"
  ],
  "listDeliveries": [
    "webhooks:read"
  ],
  "listDomains": [
    "domains:read"
  ],
  "listEmailAttachmentArchiveMembers": [
    "mail:read"
  ],
  "listEmails": [
    "mail:read"
  ],
  "listEndpoints": [
    "endpoints.pull:manage"
  ],
  "listFilters": [
    "filters:manage"
  ],
  "listFunctionLogs": [
    "functions:manage"
  ],
  "listFunctions": [
    "functions:read"
  ],
  "listFunctionSecrets": [
    "secrets:manage"
  ],
  "listGroups": [
    "members:read"
  ],
  "listMailboxAccess": [
    "members:read"
  ],
  "listOrgSecrets": [
    "secrets:manage"
  ],
  "listRepeatingSends": [
    "sent:manage"
  ],
  "listRoles": [
    "members:read"
  ],
  "listRoutes": [
    "routes:manage"
  ],
  "listSentAttachmentArchiveMembers": [
    "mail:read"
  ],
  "listSentEmails": [
    "mail:read"
  ],
  "listWakeAuthorizations": [
    "wake:manage"
  ],
  "listWakeDispatches": [
    "wake:manage"
  ],
  "listWakeSchedules": [
    "wake:manage"
  ],
  "provisionMemberAddress": [
    "member_address:manage"
  ],
  "pullWebhookEvent": [
    "endpoints:pull"
  ],
  "putAgentContact": [
    "agent_contacts:manage"
  ],
  "putAgentContactPolicy": [
    "contacts:policy"
  ],
  "putContact": [
    "contacts:write"
  ],
  "putContactPolicy": [
    "contacts:policy"
  ],
  "redeemCreditCode": [
    "credits:redeem"
  ],
  "removeAgentConnection": [
    "agent_connections:manage"
  ],
  "removeDefaultNetworkMember": [
    "agent_networks:manage"
  ],
  "reorderRoutes": [
    "routes:manage"
  ],
  "replayDelivery": [
    "webhooks:replay"
  ],
  "replayEmailWebhooks": [
    "mail.state:write"
  ],
  "replyToEmail": [
    "mail:reply"
  ],
  "rescheduleSentEmail": [
    "sent:manage"
  ],
  "revokeAgentConnection": [
    "agent_connections:update"
  ],
  "revokeCredential": [
    "keys:manage"
  ],
  "rotateKey": [
    "keys:manage"
  ],
  "rotateWebhookSecret": [
    "webhook_secret:manage"
  ],
  "runWakeSchedule": [
    "wake:manage"
  ],
  "searchEmails": [
    "mail:read"
  ],
  "searchMemories": [
    "memories:read"
  ],
  "semanticSearch": [
    "mail.search:semantic"
  ],
  "sendEmail": [
    "mail:send"
  ],
  "setFunctionRoute": [
    "functions:manage"
  ],
  "setFunctionSecret": [
    "secrets:manage"
  ],
  "setMemory": [
    "memories:write"
  ],
  "setOrgSecret": [
    "secrets:manage"
  ],
  "simulateRoute": [
    "routes:manage"
  ],
  "startAgentClaim": [
    "account:claim"
  ],
  "stopRepeatFromEmail": [
    "mail:signal"
  ],
  "testEndpoint": [
    "endpoints:manage"
  ],
  "testEndpointRules": [
    "endpoints:manage"
  ],
  "testFunction": [
    "functions:deploy"
  ],
  "unsetFunctionRoute": [
    "functions:manage"
  ],
  "updateAccount": [
    "account:manage"
  ],
  "updateDefaultNetworkMember": [
    "agent_networks:manage"
  ],
  "updateDomain": [
    "domains:manage"
  ],
  "updateEndpoint": [
    "endpoints:manage"
  ],
  "updateFilter": [
    "filters:manage"
  ],
  "updateFunction": [
    "functions:deploy"
  ],
  "updateKey": [
    "keys:manage"
  ],
  "updateRepeatingSend": [
    "sent:manage"
  ],
  "updateRoute": [
    "routes:manage"
  ],
  "updateWakeAuthorization": [
    "wake:manage"
  ],
  "updateWakeSchedule": [
    "wake:manage"
  ],
  "verifyAgentClaim": [
    "account:claim"
  ],
  "verifyDomain": [
    "domains:manage"
  ],
  "whoami": [
    "account:read"
  ]
};
