import { Args, Command, Flags } from "@oclif/core";
import { type UpdateRouteInput, updateRoute } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive routes update` changes one or more fields of an existing recipient
// route. Provide at least one field; omitted fields are left unchanged.

// Build the PATCH body from the parsed flags. Pure + exported so the mapping
// (and the "at least one field" requirement, signalled by an empty object) is
// unit-testable.
export function buildUpdateBody(flags: {
  match?: string;
  pattern?: string;
  endpoint?: string;
  domain?: string;
  priority?: number;
  enable?: boolean;
  disable?: boolean;
}): UpdateRouteInput {
  return {
    ...(flags.match
      ? { match_type: flags.match as UpdateRouteInput["match_type"] }
      : {}),
    ...(flags.pattern ? { pattern: flags.pattern } : {}),
    ...(flags.endpoint ? { endpoint_id: flags.endpoint } : {}),
    ...(flags.domain ? { domain_id: flags.domain } : {}),
    ...(flags.priority != null ? { priority: flags.priority } : {}),
    ...(flags.enable ? { enabled: true } : {}),
    ...(flags.disable ? { enabled: false } : {}),
  };
}

class RoutesUpdateCommand extends Command {
  static description = `Update an existing recipient route.

  Change the pattern, match type, target endpoint, domain scope, priority, or
  enabled state. Provide at least one field; anything omitted is left as-is.`;

  static summary = "Update a recipient route";

  static examples = [
    "<%= config.bin %> routes update <route-id> --priority 5",
    "<%= config.bin %> routes update <route-id> --pattern alice@acme.com",
    "<%= config.bin %> routes update <route-id> --disable",
  ];

  static args = {
    id: Args.string({
      description: "Route id (UUID) to update.",
      required: true,
    }),
  };

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
    match: Flags.string({
      description: "New match type for the pattern.",
      options: ["exact", "wildcard", "regex"],
    }),
    pattern: Flags.string({
      description: "New recipient address or wildcard pattern.",
    }),
    endpoint: Flags.string({ description: "New target endpoint id (UUID)." }),
    domain: Flags.string({ description: "New domain scope id (UUID)." }),
    priority: Flags.integer({
      description:
        "New evaluation priority within a scope; lower is checked first.",
    }),
    enable: Flags.boolean({
      description: "Enable the route.",
      exclusive: ["disable"],
    }),
    disable: Flags.boolean({
      description: "Disable the route.",
      exclusive: ["enable"],
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoutesUpdateCommand);

    const body = buildUpdateBody(flags);

    if (Object.keys(body).length === 0) {
      process.stderr.write(
        "Provide at least one field to update (--match, --pattern, --endpoint, --domain, --priority, --enable/--disable).\n",
      );
      process.exitCode = 1;
      return;
    }

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await updateRoute({
        client: apiClient.client,
        path: { id: args.id },
        body,
        responseStyle: "fields",
      });

      if (result.error) {
        const payload = extractErrorPayload(result.error);
        writeErrorWithHints(payload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }

      this.log(
        JSON.stringify((result.data as { data: unknown }).data, null, 2),
      );
    });
  }
}

export default RoutesUpdateCommand;
