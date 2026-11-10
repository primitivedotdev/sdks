/**
 * Permissions and built-in role keys declared by the Primitive API, from
 * the spec's `x-primitive-permission` extension and its `BuiltinRoleKey`
 * schema.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run `pnpm generate:openapi` to regenerate.
 */

/** Every permission an operation in this API version requires. */
export const PERMISSIONS = [
  "access_mode:manage",
  "account:claim",
  "account:manage",
  "account:read",
  "activity:read_self",
  "agent_connections:manage",
  "agent_connections:read_self",
  "agent_connections:update",
  "agent_contact_policy:read",
  "agent_contacts:manage",
  "agent_networks:admit",
  "agent_networks:manage",
  "agent_networks:read",
  "agent_work:manage",
  "agent_work:read",
  "agent_work:write",
  "changes:read",
  "contacts:delete",
  "contacts:policy",
  "contacts:read",
  "contacts:write",
  "credential_events:read",
  "credential_policy:manage",
  "credentials:read",
  "credentials:revoke_all",
  "credentials:revoke_self",
  "credits:read",
  "credits:redeem",
  "delegations:manage",
  "domains:manage",
  "domains:read",
  "endpoints:manage",
  "endpoints:pull",
  "filters:manage",
  "functions:deploy",
  "functions:manage",
  "functions:read",
  "interactions:advance",
  "interactions:read",
  "interactions:send",
  "invitations:manage",
  "keys:manage",
  "keys:read",
  "mail.raw:read",
  "mail.search:semantic",
  "mail.state:write",
  "mail:delete",
  "mail:read",
  "mail:reply",
  "mail:send",
  "mail:send_as_member",
  "mail:send_batch",
  "mail:share_own",
  "mail:signal",
  "mail_sync:manage",
  "member_address:manage",
  "members:manage",
  "members:read",
  "memories:read",
  "memories:write",
  "notes:delete",
  "notes:read",
  "notes:write",
  "oauth_grants:manage",
  "org:manage",
  "org:read",
  "projects:manage",
  "roles:assign",
  "routes:manage",
  "search_settings:manage",
  "secrets:manage",
  "sent:cancel",
  "sent:manage",
  "templates:install",
  "threads:mute",
  "threads:read",
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
  "acceptEmailRuleRequest": [
    "mail:read",
    "mail:share_own"
  ],
  "addDefaultNetworkMember": [
    "agent_networks:manage"
  ],
  "addDomain": [
    "domains:manage"
  ],
  "agentWorkAgreeDeadline": [
    "agent_work:manage"
  ],
  "agentWorkCreate": [
    "agent_work:write"
  ],
  "agentWorkGet": [
    "agent_work:read"
  ],
  "agentWorkList": [
    "agent_work:read"
  ],
  "agentWorkManageState": [
    "agent_work:manage"
  ],
  "agentWorkProposeDeadline": [
    "agent_work:write"
  ],
  "agentWorkReportStatus": [
    "agent_work:write"
  ],
  "agentWorkWithdrawDeadline": [
    "agent_work:manage"
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
  "checkEmailRuleRequestTarget": [
    "mail:read",
    "members:read"
  ],
  "checkSendability": [
    "mail:send"
  ],
  "checkVanityInboxName": [
    "domains:read"
  ],
  "claimAgentConnection": [
    "agent_connections:update"
  ],
  "claimVanityInboxName": [
    "domains:manage"
  ],
  "cliLogout": [
    "credentials:revoke_self"
  ],
  "compileEmailRule": [
    "mail:read"
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
  "createEmailRule": [
    "mail:read"
  ],
  "createEmailRuleRequest": [
    "mail:read"
  ],
  "createEndpoint": [
    "endpoints:manage"
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
  "createGroup": [
    "roles:assign"
  ],
  "createKey": [
    "keys:manage"
  ],
  "createOrgSecret": [
    "secrets:manage"
  ],
  "createProject": [
    "projects:manage"
  ],
  "createRole": [
    "roles:assign"
  ],
  "createRoute": [
    "routes:manage"
  ],
  "createWakeAuthorization": [
    "wake:manage",
    "endpoints:manage"
  ],
  "createWakeSchedule": [
    "wake:manage",
    "mail:send"
  ],
  "decideAccessMode": [
    "access_mode:manage"
  ],
  "decideSuspension": [
    "members:manage"
  ],
  "declineEmailRuleRequest": [
    "mail:read"
  ],
  "deleteAddressNote": [
    "notes:delete"
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
  "deleteEmailRule": [
    "mail:read"
  ],
  "deleteEmailRuleRequest": [
    "mail:read"
  ],
  "deleteEndpoint": [
    "endpoints:manage"
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
  "deleteGroup": [
    "roles:assign"
  ],
  "deleteMemory": [
    "memories:write"
  ],
  "deleteOrgSecret": [
    "secrets:manage"
  ],
  "deleteProject": [
    "projects:manage"
  ],
  "deleteRepeatingSend": [
    "sent:manage"
  ],
  "deleteRole": [
    "roles:assign"
  ],
  "deleteRoute": [
    "routes:manage"
  ],
  "deleteSentEmail": [
    "sent:manage"
  ],
  "deleteWakeAuthorization": [
    "wake:manage",
    "endpoints:manage"
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
  "downloadSentAttachments": [
    "mail:read"
  ],
  "endBreakGlass": [
    "access_mode:manage"
  ],
  "getAccessMode": [
    "members:read"
  ],
  "getAccount": [
    "account:read"
  ],
  "getAddressNote": [
    "notes:read"
  ],
  "getAgentConnectionSettings": [
    "agent_connections:manage"
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
  "getDelivery": [
    "webhooks:read"
  ],
  "getDomainAgentAuthorization": [
    "domains:read"
  ],
  "getEmail": [
    "mail:read"
  ],
  "getEmailReadable": [
    "mail:read"
  ],
  "getEmailRule": [
    "mail:read"
  ],
  "getEmailRuleRequest": [
    "mail:read"
  ],
  "getEmailRuleScope": [
    "mail:read"
  ],
  "getEmailRuleShare": [
    "mail:read"
  ],
  "getEmailRuleVocabulary": [
    "mail:read"
  ],
  "getEndpoint": [
    "webhooks:read"
  ],
  "getEndpointSigningSecret": [
    "endpoints:manage"
  ],
  "getFunction": [
    "functions:read"
  ],
  "getFunctionDeployment": [
    "functions:read"
  ],
  "getFunctionInvocation": [
    "functions:manage"
  ],
  "getFunctionRouting": [
    "functions:read"
  ],
  "getFunctionRuntimeKey": [
    "functions:read"
  ],
  "getFunctionSource": [
    "functions:manage"
  ],
  "getFunctionTestRunTrace": [
    "functions:manage"
  ],
  "getFunctionUsage": [
    "functions:read"
  ],
  "getFunctionUsers": [
    "functions:read"
  ],
  "getInboundHourlyStats": [
    "mail:read"
  ],
  "getInboxStatus": [
    "domains:read"
  ],
  "getInteraction": [
    "interactions:read"
  ],
  "getKey": [
    "keys:read"
  ],
  "getKeyBuilder": [
    "keys:read"
  ],
  "getKeySuggestion": [
    "credentials:read"
  ],
  "getMemory": [
    "memories:read"
  ],
  "getOrgFunctionFallback": [
    "functions:read"
  ],
  "getOrgFunctionInvocationSeries": [
    "functions:read"
  ],
  "getOrgFunctionUsage": [
    "functions:read"
  ],
  "getOrgRoutingTopology": [
    "functions:read"
  ],
  "getOutboundStatus": [
    "domains:read"
  ],
  "getOwnAgentConnection": [
    "agent_connections:read_self"
  ],
  "getProject": [
    "projects:manage"
  ],
  "getRelayAutoJoin": [
    "members:read"
  ],
  "getRepeatingSend": [
    "sent:manage"
  ],
  "getSearchSettings": [
    "org:read"
  ],
  "getSendPermissions": [
    "account:read"
  ],
  "getSentEmail": [
    "mail:read"
  ],
  "getSentHourlyStats": [
    "mail:read"
  ],
  "getStorageStats": [
    "org:read"
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
  "getWebhookDeliveryStats": [
    "webhooks:read"
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
  "inviteOrganizationMember": [
    "invitations:manage"
  ],
  "inviteProjectMember": [
    "invitations:manage"
  ],
  "listActivityObjects": [
    "activity:read_self"
  ],
  "listAddressNotes": [
    "notes:read"
  ],
  "listAddressNotesBatch": [
    "notes:read"
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
  "listBreakGlass": [
    "access_mode:manage"
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
  "listEmailRuleDecisions": [
    "mail:read"
  ],
  "listEmailRuleRequests": [
    "mail:read"
  ],
  "listEmailRuleResults": [
    "mail:read"
  ],
  "listEmailRules": [
    "mail:read"
  ],
  "listEmailRuleScopeOptions": [
    "mail:read"
  ],
  "listEmailRuleShareEmails": [
    "mail:read"
  ],
  "listEmailRuleShares": [
    "mail:read"
  ],
  "listEmailRuleVersions": [
    "mail:read"
  ],
  "listEmails": [
    "mail:read"
  ],
  "listEndpoints": [
    "webhooks:read"
  ],
  "listFilters": [
    "filters:manage"
  ],
  "listFunctionActivity": [
    "functions:manage"
  ],
  "listFunctionDeployments": [
    "functions:read"
  ],
  "listFunctionInvocations": [
    "functions:manage"
  ],
  "listFunctionLogs": [
    "functions:manage"
  ],
  "listFunctionRuntimeKeyPresets": [
    "functions:read"
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
  "listInteractions": [
    "interactions:read"
  ],
  "listKeys": [
    "keys:read"
  ],
  "listMailboxAccess": [
    "members:read"
  ],
  "listMailRouting": [
    "mail_sync:manage"
  ],
  "listMailTopicEdits": [
    "mail_sync:manage"
  ],
  "listMailTopicGenerations": [
    "mail_sync:manage"
  ],
  "listMutedThreads": [
    "threads:mute"
  ],
  "listOAuthGrants": [
    "oauth_grants:manage"
  ],
  "listOrganizationInvitations": [
    "invitations:manage"
  ],
  "listOrganizationPeople": [
    "members:read"
  ],
  "listOrgSecrets": [
    "secrets:manage"
  ],
  "listOwnedItems": [
    "members:manage"
  ],
  "listProjectInvitations": [
    "invitations:manage"
  ],
  "listProjects": [
    "projects:manage"
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
  "listSuspensions": [
    "members:manage"
  ],
  "listThreadReadStates": [
    "threads:read"
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
  "lookupFunction": [
    "functions:read"
  ],
  "markThreadRead": [
    "threads:read"
  ],
  "muteThread": [
    "threads:mute"
  ],
  "prepareContactAcceptance": [
    "mail:read"
  ],
  "prepareContactRequest": [
    "mail:send"
  ],
  "provisionMemberAddress": [
    "member_address:manage"
  ],
  "pullWebhookEvent": [
    "endpoints:pull"
  ],
  "putAddressNote": [
    "notes:write"
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
  "reaffirmFunctionRuntimeKey": [
    "functions:deploy"
  ],
  "redeemCreditCode": [
    "credits:redeem"
  ],
  "redeployFunction": [
    "functions:deploy"
  ],
  "releaseSentEmail": [
    "sent:manage"
  ],
  "removeAgentConnection": [
    "agent_connections:manage"
  ],
  "removeDefaultNetworkMember": [
    "agent_networks:manage"
  ],
  "removeMember": [
    "members:manage"
  ],
  "removeOrganizationLogo": [
    "org:manage"
  ],
  "removeOwnAgentAccess": [
    "member_address:manage"
  ],
  "renameAgentConnection": [
    "agent_connections:update"
  ],
  "reorderRoutes": [
    "routes:manage"
  ],
  "replayDelivery": [
    "webhooks:replay"
  ],
  "replayEmailWebhooks": [
    "webhooks:replay"
  ],
  "replyToEmail": [
    "mail:reply"
  ],
  "requestFunctionRuntimeKeyRunner": [
    "functions:deploy"
  ],
  "rescheduleSentEmail": [
    "sent:manage"
  ],
  "revokeAgentConnection": [
    "agent_connections:update"
  ],
  "revokeAllCredentials": [
    "credentials:revoke_all"
  ],
  "revokeCredential": [
    "keys:manage"
  ],
  "revokeOAuthGrant": [
    "oauth_grants:manage"
  ],
  "revokeOrganizationInvitation": [
    "invitations:manage"
  ],
  "revokeProjectInvitation": [
    "invitations:manage"
  ],
  "rotateEndpointSigningSecret": [
    "endpoints:manage"
  ],
  "rotateKey": [
    "keys:manage"
  ],
  "rotateWebhookSecret": [
    "webhook_secret:manage"
  ],
  "runWakeSchedule": [
    "wake:manage",
    "mail:send"
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
  "sendInteractionStep": [
    "interactions:advance",
    "mail:send"
  ],
  "sendMailBatch": [
    "mail:send",
    "mail:send_batch"
  ],
  "setAccessMode": [
    "access_mode:manage"
  ],
  "setAgentConnectionVisibility": [
    "agent_connections:manage"
  ],
  "setFunctionRoute": [
    "functions:manage"
  ],
  "setFunctionRuntimeKey": [
    "functions:deploy"
  ],
  "setFunctionSecret": [
    "secrets:manage"
  ],
  "setMailboxAccess": [
    "delegations:manage"
  ],
  "setMemberRole": [
    "roles:assign"
  ],
  "setMemory": [
    "memories:write"
  ],
  "setOrgSecret": [
    "secrets:manage"
  ],
  "setOwnMailboxAccess": [
    "member_address:manage",
    "mail:send_as_member"
  ],
  "setRelayAutoJoin": [
    "members:manage"
  ],
  "signalEmail": [
    "mail:signal"
  ],
  "simulateRoute": [
    "routes:manage"
  ],
  "startAgentClaim": [
    "account:claim"
  ],
  "startBreakGlass": [
    "access_mode:manage"
  ],
  "startInteraction": [
    "interactions:send",
    "mail:send"
  ],
  "stopRepeatFromEmail": [
    "mail:signal"
  ],
  "suspendFunctionRuntimeKey": [
    "functions:deploy"
  ],
  "testEmailRule": [
    "mail:read"
  ],
  "testEmailRuleOnSample": [
    "mail:read"
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
  "transferOwnedItems": [
    "members:manage"
  ],
  "unmuteThread": [
    "threads:mute"
  ],
  "unsetFunctionRoute": [
    "functions:manage"
  ],
  "updateAccount": [
    "account:manage"
  ],
  "updateAgentConnectionSettings": [
    "agent_connections:manage"
  ],
  "updateCredentialPolicy": [
    "credential_policy:manage"
  ],
  "updateDefaultNetworkMember": [
    "agent_networks:manage"
  ],
  "updateDomain": [
    "domains:manage"
  ],
  "updateEmailRule": [
    "mail:read"
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
  "updateFunctionFromTemplate": [
    "templates:install",
    "functions:deploy"
  ],
  "updateFunctionTags": [
    "functions:manage"
  ],
  "updateGroup": [
    "roles:assign"
  ],
  "updateKey": [
    "keys:manage"
  ],
  "updateMailRouting": [
    "mail_sync:manage"
  ],
  "updateMailTopicEdits": [
    "mail_sync:manage"
  ],
  "updateMailTopicGenerations": [
    "mail_sync:manage"
  ],
  "updateOrganization": [
    "org:manage"
  ],
  "updateOrganizationLogo": [
    "org:manage"
  ],
  "updateProject": [
    "projects:manage"
  ],
  "updateRepeatingSend": [
    "sent:manage"
  ],
  "updateRole": [
    "roles:assign"
  ],
  "updateRoute": [
    "routes:manage"
  ],
  "updateSearchSettings": [
    "search_settings:manage"
  ],
  "updateWakeAuthorization": [
    "wake:manage",
    "endpoints:manage"
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
  ],
  "withdrawEmailRuleRequest": [
    "mail:read"
  ]
};

/**
 * The keys of the built-in roles, from the spec's `BuiltinRoleKey`.
 * Template and custom roles use other keys.
 */
export const BUILTIN_ROLE_KEYS = [
  "owner",
  "admin",
  "operator",
  "member"
] as const;
