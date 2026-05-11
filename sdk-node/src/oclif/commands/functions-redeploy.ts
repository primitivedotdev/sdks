import { Command, Flags } from "@oclif/core";
import { updateFunction } from "../../api/generated/sdk.gen.js";
import type { FunctionDetail } from "../../api/generated/types.gen.js";
import { PrimitiveApiClient } from "../../api/index.js";
import {
  extractErrorPayload,
  readTextFileFlag,
  removeStaleSavedCredentialOnUnauthorized,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { resolveCliAuth } from "../auth.js";

// `primitive functions:redeploy` is the agent-grade shortcut for
// `functions:update-function`. Same file-reading ergonomic as
// functions:deploy but for an existing function. Use this to push a
// new bundle, OR to refresh secret bindings: passing the
// previously-deployed bundle (or any equivalent file) re-runs the
// deploy and refreshes env from the secrets table, which is how
// secret writes go live.

class FunctionsRedeployCommand extends Command {
  static description =
    `Update or redeploy a function from a bundled handler file. Agent-grade shortcut for functions:update-function.

  Use to push a new bundle OR to refresh secret bindings into the
  running handler. The same file is fine for both: the deploy reads
  the bindings table fresh on every call, so passing the existing
  bundle picks up any secret writes since the last deploy.`;

  static summary = "Redeploy a function from a bundled handler file";

  static examples = [
    "<%= config.bin %> functions:redeploy --id <fn-id> --file ./bundle.js",
    "<%= config.bin %> functions:redeploy --id <fn-id> --file ./bundle.js --source-map-file ./bundle.js.map",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key (defaults to PRIMITIVE_API_KEY or saved `primitive login` credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "api-base-url-2": Flags.string({
      description:
        "Override the attachments-supporting send host base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_2",
      hidden: true,
    }),
    id: Flags.string({
      description: "Function id (UUID). The function must already exist.",
      required: true,
    }),
    file: Flags.string({
      description:
        "Path to the bundled ESM handler file. Loaded as the `code` body field.",
      required: true,
    }),
    "source-map-file": Flags.string({
      description:
        "Optional path to a source map for the bundle. Used to symbolicate stack traces in the function's logs.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FunctionsRedeployCommand);

    await runWithTiming(flags.time, async () => {
      // Reads inside the timed block: --time captures disk I/O too,
      // which is the latency the flag is meant to surface.
      const code = readTextFileFlag(flags.file, "--file");
      const sourceMap = flags["source-map-file"]
        ? readTextFileFlag(flags["source-map-file"], "--source-map-file")
        : undefined;

      const baseUrlOverridden =
        flags["api-base-url-1"] !== undefined ||
        flags["api-base-url-2"] !== undefined;
      const auth = resolveCliAuth({
        apiKey: flags["api-key"],
        apiBaseUrl1: flags["api-base-url-1"],
        apiBaseUrl2: flags["api-base-url-2"],
        configDir: this.config.configDir,
      });
      const apiClient = new PrimitiveApiClient({
        apiKey: auth.apiKey,
        apiBaseUrl1: auth.apiBaseUrl1,
        apiBaseUrl2: auth.apiBaseUrl2,
      });

      const authFailureContext = {
        auth,
        baseUrlOverridden,
        configDir: this.config.configDir,
      };

      const result = await updateFunction({
        path: { id: flags.id },
        body: {
          code,
          ...(sourceMap !== undefined ? { sourceMap } : {}),
        },
        client: apiClient.client,
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        writeErrorWithHints(errorPayload);
        removeStaleSavedCredentialOnUnauthorized({
          ...authFailureContext,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const envelope = result.data as { data?: FunctionDetail } | undefined;
      this.log(JSON.stringify(envelope?.data ?? null, null, 2));
    });
  }
}

export default FunctionsRedeployCommand;
