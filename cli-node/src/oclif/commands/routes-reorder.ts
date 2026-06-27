import { Command, Flags } from "@oclif/core";
import { reorderRoutes } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive routes reorder` updates the priority of one or more routes in a
// single call. Priority sets evaluation order within a scope (lower is checked
// first). Pass each route as --set <route-id>=<priority>, repeatable.

// Parse the repeatable --set <route-id>=<priority> flag into the reorder body.
// Pure + exported so the parsing rules are unit-testable.
export function parseReorderUpdates(
  set: string[],
): { updates: Array<{ id: string; priority: number }> } | { error: string } {
  const updates: Array<{ id: string; priority: number }> = [];
  const seen = new Set<string>();
  for (const pair of set) {
    const eq = pair.lastIndexOf("=");
    // Route ids are UUIDs (case-insensitive, canonically lowercase), so
    // normalize before deduping and sending so two casings of one id can't
    // slip through as conflicting updates.
    const id = (eq >= 0 ? pair.slice(0, eq).trim() : "").toLowerCase();
    const priority = eq >= 0 ? Number(pair.slice(eq + 1).trim()) : Number.NaN;
    if (!id || !Number.isInteger(priority) || priority < 0) {
      return {
        error: `Invalid --set value "${pair}"; expected <route-id>=<priority> with a non-negative integer priority.`,
      };
    }
    if (seen.has(id)) {
      return {
        error: `Route ${id} appears more than once in --set; specify each route at most once.`,
      };
    }
    seen.add(id);
    updates.push({ id, priority });
  }
  return { updates };
}

class RoutesReorderCommand extends Command {
  static description =
    `Set the priority of one or more recipient routes in a single call.

  Priority controls evaluation order within a scope; lower is checked first.
  Pass --set <route-id>=<priority> once per route you want to move.`;

  static summary = "Reorder recipient routes";

  static examples = [
    "<%= config.bin %> routes reorder --set <route-id>=10",
    "<%= config.bin %> routes reorder --set <id-a>=10 --set <id-b>=20",
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
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
    set: Flags.string({
      description:
        "A route and its new priority as <route-id>=<priority>. Repeatable.",
      multiple: true,
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(RoutesReorderCommand);

    const parsed = parseReorderUpdates(flags.set);
    if ("error" in parsed) {
      process.stderr.write(`${parsed.error}\n`);
      process.exitCode = 1;
      return;
    }
    const { updates } = parsed;

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await reorderRoutes({
        client: apiClient.client,
        body: { updates },
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

export default RoutesReorderCommand;
