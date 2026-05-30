import { Command, Flags } from "@oclif/core";
import { setFunctionRoute } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive functions:route-set` binds inbound mail to a function. The
// route target is either a specific verified domain (scoped) or the
// org-wide fallback. Without this command, the customer-onboarding loop
// goes deploy -> test -> "why is my function never invoked?" because
// deploy does not auto-create a route binding; one must be set
// explicitly. See `functions:route-get` to inspect the current binding
// and `functions:routing-topology` for the org-wide view.
//
// Conflict handling: if another function is already bound at the target,
// the API returns a `conflict` envelope describing the holder rather
// than overwriting. Pass `--takeover` to deactivate the prior binding
// in the same call.

class FunctionsRouteSetCommand extends Command {
  static description =
    `Bind inbound mail to a function by setting its route target.

  Exactly one of --domain or --fallback is required. --domain scopes the
  binding to a single verified inbound domain. --fallback binds the
  function to any active domain that has no scoped binding of its own.

  If another function is already bound at the target, the API returns a
  conflict envelope rather than overwriting; re-run with --takeover to
  deactivate the prior binding before installing this one.`;

  static summary = "Bind inbound mail to a function";

  static examples = [
    "<%= config.bin %> functions route-set --id <fn-id> --domain <domain-id>",
    "<%= config.bin %> functions route-set --id <fn-id> --fallback",
    "<%= config.bin %> functions route-set --id <fn-id> --domain <domain-id> --takeover",
  ];

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
    id: Flags.string({
      description: "Function id (UUID) to bind a route to.",
      required: true,
    }),
    domain: Flags.string({
      description:
        "Verified inbound domain id (UUID) to scope this function to. Mutually exclusive with --fallback.",
      exclusive: ["fallback"],
    }),
    fallback: Flags.boolean({
      description:
        "Bind this function as the org fallback (any active domain without a scoped binding). Mutually exclusive with --domain.",
      exclusive: ["domain"],
    }),
    takeover: Flags.boolean({
      description:
        "Deactivate any conflicting binding before installing this one. Without this flag, the API returns a `conflict` envelope when another function is already bound at the target.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FunctionsRouteSetCommand);

    if (!flags.domain && !flags.fallback) {
      process.stderr.write(
        "Provide exactly one of --domain (scoped binding) or --fallback (org fallback).\n",
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
      const target = flags.domain
        ? { kind: "domain" as const, domainId: flags.domain }
        : { kind: "fallback" as const };

      const result = await setFunctionRoute({
        client: apiClient.client,
        path: { id: flags.id },
        body: {
          target,
          ...(flags.takeover ? { takeover: true } : {}),
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

export default FunctionsRouteSetCommand;
