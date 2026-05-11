import { Command, Flags } from "@oclif/core";
import { createFunction } from "../../api/generated/sdk.gen.js";
import type { CreateFunctionResult } from "../../api/generated/types.gen.js";
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
import { emitRawSendMailFetchWarning } from "../lint/raw-send-mail-fetch.js";

// `primitive functions:deploy` is the agent-grade shortcut for
// `functions:create-function`. The underlying operation takes `code`
// as a string in the JSON body, which is awkward at the CLI for
// multi-line bundles: agents would otherwise have to shell-escape an
// entire ESM file or write a temp body.json. This command reads the
// bundle straight off disk via --file, so the natural workflow is:
//
//     esbuild handler.ts --bundle --format=esm --outfile=bundle.js
//     primitive functions:deploy --name myfn --file bundle.js
//
// Source maps follow the same shape via --source-map-file. They are
// stored only on the runtime side (not in our database) so dropping
// them later in the pipeline is fine; the CLI just hands them through.
//
// For full control (raw body, --raw-body JSON, etc.) the underlying
// `functions:create-function` operation stays available.

class FunctionsDeployCommand extends Command {
  static description =
    `Deploy a new function from a bundled handler file. Agent-grade shortcut for functions:create-function.

  Reads the bundle off disk (--file) instead of forcing the caller to
  serialize the source into a JSON body. Use the underlying operation
  \`functions:create-function\` if you need the full flag surface
  (raw-body JSON, etc.).`;

  static summary = "Deploy a new function from a bundled handler file";

  static examples = [
    "<%= config.bin %> functions:deploy --name forwarder --file ./bundle.js",
    "<%= config.bin %> functions:deploy --name forwarder --file ./bundle.js --source-map-file ./bundle.js.map",
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
    name: Flags.string({
      description:
        "Slug-style name. Lowercase letters, digits, hyphens, underscores. 1-64 chars. Must be unique within the org.",
      required: true,
    }),
    file: Flags.string({
      description:
        "Path to the bundled ESM handler file (single self-contained module). Loaded as the `code` body field.",
      required: true,
    }),
    "source-map-file": Flags.string({
      description:
        "Optional path to a source map for the bundle. Stored only on the runtime side and used to symbolicate stack traces.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FunctionsDeployCommand);

    await runWithTiming(flags.time, async () => {
      // Reads are inside the timed block so --time captures disk I/O
      // alongside the API call. A pathological filesystem (NFS, slow
      // FUSE mount) showing up here is exactly the kind of latency
      // surprise --time is meant to surface.
      const code = readTextFileFlag(flags.file, "--file");
      const sourceMap = flags["source-map-file"]
        ? readTextFileFlag(flags["source-map-file"], "--source-map-file")
        : undefined;

      // Non-blocking deploy-time lint: if the bundle has a raw
      // fetch(...) call against /send-mail, nudge the author toward
      // `createPrimitiveClient` from `@primitivedotdev/sdk/api`.
      // The warning lands on stderr so it never contaminates the
      // JSON stdout the caller may pipe into jq.
      emitRawSendMailFetchWarning(code, (chunk) => process.stderr.write(chunk));

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

      const result = await createFunction({
        body: {
          name: flags.name,
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

      const envelope = result.data as
        | { data?: CreateFunctionResult }
        | undefined;
      this.log(JSON.stringify(envelope?.data ?? null, null, 2));
    });
  }
}

export default FunctionsDeployCommand;
