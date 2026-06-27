import { Args, Command, Flags } from "@oclif/core";
import { createRoute } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive routes add` creates a recipient route. Pass --function to route an
// address to a function (its dedicated route-target endpoint is minted in the
// same call, enabling per-address function routing like alice@d -> functionA),
// or --endpoint to target an existing endpoint. Inbound mail resolves to a
// single destination at delivery time; see `routes test` to preview a recipient.

// Resolve the create target from the mutually-exclusive --function / --endpoint
// flags. oclif's `exclusive` already rejects passing BOTH; this enforces that
// exactly one is present. Pure + exported so the rule is unit-testable.
export function resolveCreateTarget(flags: {
  function?: string;
  endpoint?: string;
}): { function_id: string } | { endpoint_id: string } | { error: string } {
  if (flags.function) return { function_id: flags.function };
  if (flags.endpoint) return { endpoint_id: flags.endpoint };
  return {
    error:
      "Provide exactly one of --function (route to a function) or --endpoint (an existing endpoint).",
  };
}

class RoutesAddCommand extends Command {
  static description =
    `Create a recipient route binding an address pattern to a destination.

  Provide exactly one of --function (route to a function; its route-target
  endpoint is created in the same transaction) or --endpoint (an existing
  endpoint). The match type defaults to exact; use --match wildcard for
  patterns like 'support+*@acme.com'.`;

  static summary = "Add a recipient route";

  static examples = [
    "<%= config.bin %> routes add alice@acme.com --function <fn-id>",
    "<%= config.bin %> routes add 'support+*@acme.com' --match wildcard --function <fn-id>",
    "<%= config.bin %> routes add billing@acme.com --endpoint <endpoint-id> --priority 10",
  ];

  static args = {
    pattern: Args.string({
      description:
        "Recipient address or wildcard pattern (e.g. alice@acme.com).",
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
    function: Flags.string({
      description:
        "Function id to route this address to (its route-target endpoint is minted if needed). Mutually exclusive with --endpoint.",
      exclusive: ["endpoint"],
    }),
    endpoint: Flags.string({
      description:
        "Existing endpoint id to route to. Mutually exclusive with --function.",
      exclusive: ["function"],
    }),
    match: Flags.string({
      description:
        "Match type for the pattern. regex requires the Power plan and may be rejected if not enabled.",
      options: ["exact", "wildcard", "regex"],
      default: "exact",
    }),
    domain: Flags.string({
      description:
        "Scope the route to this domain id (defaults to the pattern's domain).",
    }),
    priority: Flags.integer({
      description: "Evaluation order within a scope; lower is checked first.",
    }),
    disabled: Flags.boolean({ description: "Create the route disabled." }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoutesAddCommand);

    const target = resolveCreateTarget(flags);
    if ("error" in target) {
      process.stderr.write(`${target.error}\n`);
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
      const result = await createRoute({
        client: apiClient.client,
        body: {
          match_type: flags.match as "exact" | "wildcard" | "regex",
          pattern: args.pattern,
          ...target,
          ...(flags.domain ? { domain_id: flags.domain } : {}),
          ...(flags.priority != null ? { priority: flags.priority } : {}),
          ...(flags.disabled ? { enabled: false } : {}),
        },
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

export default RoutesAddCommand;
