import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "@primitivedotdev/api-core";

// Operation ids (`tag:command`) the CLI offers no generated command for.
// Creating, rotating and changing an API key need the person to approve the
// request in the browser, and revoking from the CLI covers API keys only, so
// these go through the hand-rolled `primitive keys` commands instead. They
// are left out of `list-operations`, `describe` and shell completion. The SDK
// clients keep these methods.
export const KEY_WRITE_OPERATION_IDS: ReadonlySet<string> = new Set([
  "credentials:create-key",
  "credentials:rotate-key",
  "credentials:update-key",
  "credentials:revoke-credential",
]);

/** The operations the CLI generates commands for: the manifest without the key writes. */
export const cliOperationManifest: PrimitiveOperationManifest[] =
  operationManifest.filter(
    (operation) =>
      !KEY_WRITE_OPERATION_IDS.has(
        `${operation.tagCommand}:${operation.command}`,
      ),
  );
