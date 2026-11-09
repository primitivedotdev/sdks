/**
 * Short names for the key, credential, role and caller-identity shapes the
 * grant helpers use. The spec names these per operation; these aliases keep
 * the hand-written code and the SDK's public types readable, and stay in step
 * with the spec because they are derived from the generated types.
 */
import type {
  CredentialsCreateKeyInput,
  CredentialsCreateKeyResult,
  CredentialsGetCredentialPolicyResult,
  CredentialsGetKeyBuilderResult,
  CredentialsListCredentialEventsResult,
  CredentialsListCredentialsResult,
  CredentialsRevokeCredentialResult,
  CredentialsRotateKeyResult,
  CredentialsUpdateKeyInput,
  CredentialsUpdateKeyResult,
  GetAccessModeResult,
  ListGroupsResult,
  ListMailboxAccessResult,
  ListRolesResult,
  WhoamiResponses,
} from "./api/index.js";

export type CreateKeyInput = CredentialsCreateKeyInput;
export type CreatedKey = CredentialsCreateKeyResult;
export type RotatedKey = CredentialsRotateKeyResult;
export type UpdateKeyInput = CredentialsUpdateKeyInput;
export type UpdatedKey = CredentialsUpdateKeyResult;
export type KeyBuilder = CredentialsGetKeyBuilderResult;

/** The `grant` of `createKey`: a preset name or a `KeyGrantSpec`. */
export type KeyGrant = CredentialsCreateKeyInput["grant"];
export type KeyGrantSpec = Exclude<KeyGrant, string>;
export type KeyPreset = KeyGrantSpec["preset"];

export type CredentialList = CredentialsListCredentialsResult;
export type CredentialRow = CredentialList["items"][number];
export type CredentialKind = CredentialRow["kind"];
export type CredentialEventList = CredentialsListCredentialEventsResult;
export type CredentialPolicy = CredentialsGetCredentialPolicyResult;
export type RevokeCredentialResult = CredentialsRevokeCredentialResult;

export type RoleList = ListRolesResult;
export type GroupList = ListGroupsResult;
export type MailboxAccessList = ListMailboxAccessResult;
export type AccessMode = GetAccessModeResult;

/** `GET /whoami`: the authenticated caller. */
export type CallerIdentity = WhoamiResponses[200]["data"];

/** The decision `GET /whoami?check=<permission>` reports. */
export type PermissionCheck = NonNullable<CallerIdentity["check"]>;

/**
 * The grant a credential holds, as `GET /whoami?include=grant` reports it.
 * The spec leaves `grant` open, so this names the fields the CLI reads.
 */
export type GrantDescription = {
  credential_kind: string;
  actor?: unknown;
  grant_ref?: string | null;
  /** `template`, `concrete` or `computed`. */
  grant_type?: string;
  template?: string | null;
  credential_grant_id?: string | null;
  computed_from?: unknown;
  permissions: string[];
  /** `org`, or the addresses, domains and depth the grant reaches. */
  mail_scope?: unknown;
  resources?: unknown;
  expires_at?: string | null;
  catalog_version: string;
  [key: string]: unknown;
};
