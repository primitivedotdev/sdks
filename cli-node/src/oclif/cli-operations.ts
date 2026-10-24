import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "@primitivedotdev/api-core";

// Operation ids (`tag:command`) the CLI does not offer at all. Creating,
// rotating, updating and revoking API keys and other credentials happens in
// the dashboard, so these get no generated command and are left out of
// `list-operations`, `describe` and shell completion. The SDK clients keep
// these methods.
export const DASHBOARD_ONLY_OPERATION_IDS: ReadonlySet<string> = new Set([
  "keys:create-key",
  "keys:rotate-key",
  "keys:update-key",
  "credentials:revoke-credential",
]);

/** The operations the CLI offers: the manifest without the dashboard-only ones. */
export const cliOperationManifest: PrimitiveOperationManifest[] =
  operationManifest.filter(
    (operation) =>
      !DASHBOARD_ONLY_OPERATION_IDS.has(
        `${operation.tagCommand}:${operation.command}`,
      ),
  );
