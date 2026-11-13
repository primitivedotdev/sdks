import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "@primitivedotdev/api-core";

// Operation ids (`tag:command`) the CLI offers no generated command for.
// Creating, rotating and changing an API key can need the person to approve
// the request in the browser, and revoking from the CLI covers API keys only,
// so these go through the hand-rolled `primitive keys` commands instead. They
// are left out of `list-operations`, `describe` and shell completion. The SDK
// clients keep these methods.
export const KEY_WRITE_OPERATION_IDS: ReadonlySet<string> = new Set([
  "credentials:create-key",
  "credentials:rotate-key",
  "credentials:update-key",
  "credentials:revoke-credential",
]);

// Operation ids (`tag:command`) the CLI offers no command for because they
// take a credential in a request header. They are left out of
// `list-operations`, `describe` and shell completion too. The SDK clients
// keep these methods.
export const CREDENTIAL_HEADER_OPERATION_IDS: ReadonlySet<string> = new Set([
  "emails:import-google-mail-message",
]);

/** Every operation id the CLI generates no command for. */
export const CLI_OMITTED_OPERATION_IDS: ReadonlySet<string> = new Set([
  ...KEY_WRITE_OPERATION_IDS,
  ...CREDENTIAL_HEADER_OPERATION_IDS,
]);

/** The operations the CLI generates commands for: the manifest without CLI_OMITTED_OPERATION_IDS. */
export const cliOperationManifest: PrimitiveOperationManifest[] =
  operationManifest.filter(
    (operation) =>
      !CLI_OMITTED_OPERATION_IDS.has(
        `${operation.tagCommand}:${operation.command}`,
      ),
  );
