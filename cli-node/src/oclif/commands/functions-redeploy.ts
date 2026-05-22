import { Command, Flags } from "@oclif/core";
import type {
  FunctionDetail,
  FunctionSecretWriteResult,
} from "@primitivedotdev/api-core";
import {
  getFunction,
  setFunctionSecret,
  updateFunction,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  readTextFileFlag,
  removeStaleSavedCredentialOnUnauthorized,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import {
  DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS,
  DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS,
  validateDeployWaitFlags,
  waitForFunctionDeploy,
} from "../function-deploy-wait.js";
import { emitRawSendMailFetchWarning } from "../lint/raw-send-mail-fetch.js";
import {
  resolveSecretFlags,
  SECRET_FLAG_SECURITY_NOTE,
  SECRET_SOURCE_FLAGS_DESCRIPTION,
  type SecretFlagPair,
} from "../secret-flags.js";

// `primitive functions:redeploy` is the agent-grade shortcut for
// `functions:update-function`. Same file-reading ergonomic as
// functions:deploy but for an existing function. Use this to push a
// new bundle, OR to refresh secret bindings: passing the
// previously-deployed bundle (or any equivalent file) re-runs the
// deploy and refreshes env from the secrets table, which is how
// secret writes go live.
//
// Secret source flags are the one-call shortcut for "write secrets
// AND redeploy in the same command." Secrets are written FIRST so a
// single update-function call picks up every new binding; this is the
// inverse order of functions:deploy where the function must exist
// before secrets can be written.

// Final payload runRedeployWithSecrets produces on the happy path.
// `secrets` is omitted when no --secret flags were passed.
export type RedeployWithSecretsResult = {
  redeploy: FunctionDetail;
  secrets?: FunctionSecretWriteResult[];
};

// Minimal client surface runRedeployWithSecrets needs. Mirrors
// DeployApiSurface but without createFunction since the function
// already exists.
export type RedeployApiSurface = {
  setSecret: (params: { id: string; key: string; value: string }) => Promise<{
    data?: { data?: FunctionSecretWriteResult };
    error?: unknown;
  }>;
  updateFunction: (params: {
    id: string;
    code: string;
    sourceMap?: string;
  }) => Promise<{
    data?: { data?: FunctionDetail };
    error?: unknown;
  }>;
};

// Discriminated result from runRedeployWithSecrets. The caller
// surfaces either a success or an error stage so run() can write
// stage-specific stderr hints. `succeededKeys` / `failedKey` are
// populated for `set-secret` failures so the hint can list which
// keys landed before the failure.
export type RunRedeployWithSecretsResult =
  | { kind: "ok"; result: RedeployWithSecretsResult }
  | {
      kind: "error";
      stage: "set-secret";
      payload: unknown;
      succeededKeys: string[];
      failedKey: string;
      pendingKeys: string[];
    }
  | {
      kind: "error";
      stage: "redeploy";
      payload: unknown;
      succeededKeys: string[];
    };

// Pure-ish orchestration of (optional secrets +) update-function.
// Writes every secret first, then re-deploys with the new bundle so
// a single updateFunction call refreshes every binding the user
// wrote. Pulled out as a named export so the unit test can drive
// every branch with a fake RedeployApiSurface, without spinning up
// a real client or the oclif command lifecycle.
export async function runRedeployWithSecrets(
  api: RedeployApiSurface,
  params: {
    id: string;
    code: string;
    sourceMap?: string;
    secrets: SecretFlagPair[];
  },
): Promise<RunRedeployWithSecretsResult> {
  const writtenSecrets: FunctionSecretWriteResult[] = [];
  const succeededKeys: string[] = [];
  for (let i = 0; i < params.secrets.length; i++) {
    const pair = params.secrets[i];
    // Pre-compute the keys that come AFTER the current pair so a
    // set-secret failure can surface every key that was never
    // attempted, not just the one that failed.
    const pendingKeys = params.secrets.slice(i + 1).map((p) => p.key);
    const setResult = await api.setSecret({
      id: params.id,
      key: pair.key,
      value: pair.value,
    });
    if (setResult.error) {
      return {
        failedKey: pair.key,
        kind: "error",
        payload: extractErrorPayload(setResult.error),
        pendingKeys,
        stage: "set-secret",
        succeededKeys,
      };
    }
    const secret = setResult.data?.data;
    if (!secret) {
      return {
        failedKey: pair.key,
        kind: "error",
        payload: {
          code: "client_error",
          message: "Secret write returned no data",
        },
        pendingKeys,
        stage: "set-secret",
        succeededKeys,
      };
    }
    writtenSecrets.push(secret);
    succeededKeys.push(pair.key);
  }

  const updateResult = await api.updateFunction({
    code: params.code,
    id: params.id,
    ...(params.sourceMap !== undefined ? { sourceMap: params.sourceMap } : {}),
  });
  if (updateResult.error) {
    return {
      kind: "error",
      payload: extractErrorPayload(updateResult.error),
      stage: "redeploy",
      succeededKeys,
    };
  }
  const redeployed = updateResult.data?.data;
  if (!redeployed) {
    return {
      kind: "error",
      payload: {
        code: "client_error",
        message: "Redeploy returned no data",
      },
      stage: "redeploy",
      succeededKeys,
    };
  }

  return {
    kind: "ok",
    result: {
      redeploy: redeployed,
      ...(writtenSecrets.length > 0 ? { secrets: writtenSecrets } : {}),
    },
  };
}

class FunctionsRedeployCommand extends Command {
  static description =
    `Update or redeploy a function from a bundled handler file. Agent-grade shortcut for functions:update-function.

  Use to push a new bundle OR to refresh secret bindings into the
  running handler. The same file is fine for both: the deploy reads
  the bindings table fresh on every call, so passing the existing
  bundle picks up any secret writes since the last deploy.

  Pass secret source flags to write secrets BEFORE the redeploy fires;
  one update-function call then refreshes every new binding. Keys must
  match \`^[A-Z_][A-Z0-9_]*$\` (uppercase letters, digits, underscores;
  first character is a letter or underscore). With one or more secrets
  the redeploy fans out to multiple API calls (set-secret per pair,
  then update-function). ${SECRET_SOURCE_FLAGS_DESCRIPTION}`;

  static summary = "Redeploy a function from a bundled handler file";

  static examples = [
    "<%= config.bin %> functions redeploy --id <fn-id> --file ./bundle.js",
    "<%= config.bin %> functions redeploy --id <fn-id> --file ./bundle.js --wait",
    "<%= config.bin %> functions redeploy --id <fn-id> --file ./bundle.js --source-map-file ./bundle.js.map",
    "<%= config.bin %> functions redeploy --id <fn-id> --file ./bundle.js --secret OPENAI_KEY=sk-... --secret OWNER_EMAIL=me@example.com",
    "<%= config.bin %> functions redeploy --id <fn-id> --file ./bundle.js --secret-from-env OPENAI_KEY --secret-from-file PRIVATE_KEY=./private-key.pem",
    "printf '%s' \"$OPENAI_KEY\" | <%= config.bin %> functions redeploy --id <fn-id> --file ./bundle.js --secret-from-stdin OPENAI_KEY",
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
    secret: Flags.string({
      description: `Secret KEY=VALUE to write on the function before the redeploy fires. Repeatable. KEY must match \`^[A-Z_][A-Z0-9_]*$\`; VALUE may contain \`=\` (only the first \`=\` is treated as a delimiter). Each KEY may only appear once per command. Passing one or more --secret flags fans out to set-secret per pair then a single update-function call so the new bindings land in the same redeploy. ${SECRET_FLAG_SECURITY_NOTE}`,
      multiple: true,
    }),
    "secret-from-env": Flags.string({
      description:
        "Secret KEY to read from the environment and write before the redeploy. Repeatable. Example: --secret-from-env OPENAI_KEY reads process.env.OPENAI_KEY.",
      multiple: true,
    }),
    "secret-from-file": Flags.string({
      description:
        "Secret KEY=PATH to read from a UTF-8 file and write before the redeploy. Repeatable. The full file contents become the value.",
      multiple: true,
    }),
    "secret-from-env-file": Flags.string({
      description:
        "Secret FILE:KEY to read from a dotenv-style file and write before the redeploy. Repeatable. Example: --secret-from-env-file .env.local:OPENAI_KEY.",
      multiple: true,
    }),
    "secret-from-stdin": Flags.string({
      description:
        "Secret KEY to read from stdin and write before the redeploy. A single trailing line ending is stripped. Stdin is consumed once, so this flag is not repeatable.",
    }),
    wait: Flags.boolean({
      description:
        "Wait until the function deploy reaches deployed or failed. Progress is written to stderr; stdout remains the final JSON payload.",
    }),
    timeout: Flags.integer({
      default: DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS,
      description:
        "Seconds to wait when --wait is set before exiting non-zero. Use 0 to wait forever.",
    }),
    "poll-interval": Flags.integer({
      default: DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS,
      description: "Seconds between deploy-status polls when --wait is set.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FunctionsRedeployCommand);

    await runWithTiming(flags.time, async () => {
      const waitFlagError = validateDeployWaitFlags({
        pollIntervalSeconds: flags["poll-interval"],
        timeoutSeconds: flags.timeout,
      });
      if (waitFlagError) {
        process.stderr.write(`${waitFlagError}\n`);
        process.exitCode = 1;
        return;
      }

      // Validate --secret pairs BEFORE any disk read or API call so
      // a malformed input fails fast with a clear error and zero
      // side effects. The fast path (no --secret flags) skips the
      // secret-write loop entirely.
      const parsedSecrets = resolveSecretFlags({
        fromEnv: flags["secret-from-env"] ?? [],
        fromEnvFile: flags["secret-from-env-file"] ?? [],
        fromFile: flags["secret-from-file"] ?? [],
        fromStdin: flags["secret-from-stdin"],
        inline: flags.secret ?? [],
      });
      if (parsedSecrets.kind === "error") {
        process.stderr.write(`${parsedSecrets.message}\n`);
        process.exitCode = 1;
        return;
      }

      // Reads inside the timed block: --time captures disk I/O too,
      // which is the latency the flag is meant to surface.
      const code = readTextFileFlag(flags.file, "--file");
      const sourceMap = flags["source-map-file"]
        ? readTextFileFlag(flags["source-map-file"], "--source-map-file")
        : undefined;

      // Non-blocking deploy-time lint: if the bundle has a raw
      // fetch(...) call against /send-mail, nudge the author toward
      // `createPrimitiveClient` from `@primitivedotdev/sdk/api`.
      // Same check as functions:deploy; warning goes to stderr and
      // the deploy continues regardless.
      emitRawSendMailFetchWarning(code, (chunk) => process.stderr.write(chunk));

      const { apiClient, auth, baseUrlOverridden } =
        createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl1: flags["api-base-url-1"],
          apiBaseUrl2: flags["api-base-url-2"],
          configDir: this.config.configDir,
        });

      const authFailureContext = {
        auth,
        baseUrlOverridden,
        configDir: this.config.configDir,
      };

      // Adapter: thin wrappers around the generated SDK calls,
      // routed through host 1 (apiClient.client). The function
      // CRUD and secrets endpoints are not on host 2.
      const apiSurface: RedeployApiSurface = {
        setSecret: (p) =>
          setFunctionSecret({
            body: { value: p.value },
            client: apiClient.client,
            path: { id: p.id, key: p.key },
            responseStyle: "fields",
          }),
        updateFunction: (p) =>
          updateFunction({
            body: {
              code: p.code,
              ...(p.sourceMap !== undefined ? { sourceMap: p.sourceMap } : {}),
            },
            client: apiClient.client,
            path: { id: p.id },
            responseStyle: "fields",
          }),
      };

      const outcome = await runRedeployWithSecrets(apiSurface, {
        code,
        id: flags.id,
        secrets: parsedSecrets.secrets,
        ...(sourceMap !== undefined ? { sourceMap } : {}),
      });

      if (outcome.kind === "error") {
        if (outcome.stage === "set-secret") {
          const succeeded =
            outcome.succeededKeys.length > 0
              ? outcome.succeededKeys.join(", ")
              : "(none)";
          const pending =
            outcome.pendingKeys.length > 0
              ? outcome.pendingKeys.join(", ")
              : "(none)";
          const allMissing = [outcome.failedKey, ...outcome.pendingKeys].join(
            ", ",
          );
          process.stderr.write(
            `Writing secret ${outcome.failedKey} failed before the redeploy; succeeded keys so far: ${succeeded}; keys not yet attempted: ${pending}. The new bundle has NOT been deployed. Re-run \`primitive functions set-secret\` for each of [${allMissing}], then \`primitive functions redeploy --id ${flags.id} --file <bundle>\` to push them live.\n`,
          );
        } else if (outcome.stage === "redeploy") {
          const succeeded =
            outcome.succeededKeys.length > 0
              ? outcome.succeededKeys.join(", ")
              : "(none)";
          process.stderr.write(
            `Secrets [${succeeded}] were written, but the redeploy step failed; the new bindings are NOT yet live. Re-run \`primitive functions redeploy --id ${flags.id} --file <bundle>\` once the cause is fixed.\n`,
          );
        }
        writeErrorWithHints(outcome.payload);
        removeStaleSavedCredentialOnUnauthorized({
          ...authFailureContext,
          payload: outcome.payload,
        });
        process.exitCode = 1;
        return;
      }

      if (flags.wait) {
        const waitResult = await waitForFunctionDeploy({
          getFunction: (p) =>
            getFunction({
              client: apiClient.client,
              path: { id: p.id },
              responseStyle: "fields",
            }),
          id: outcome.result.redeploy.id,
          initial: outcome.result.redeploy,
          pollIntervalSeconds: flags["poll-interval"],
          timeoutSeconds: flags.timeout,
          writeStderr: (chunk) => process.stderr.write(chunk),
        });

        if (waitResult.kind === "error") {
          writeErrorWithHints(waitResult.payload);
          removeStaleSavedCredentialOnUnauthorized({
            ...authFailureContext,
            payload: waitResult.payload,
          });
          process.exitCode = 1;
          return;
        }

        if (waitResult.kind === "timeout") {
          const status = waitResult.lastFunction?.deploy_status ?? "unknown";
          process.stderr.write(
            `Timed out after ${flags.timeout}s waiting for function ${outcome.result.redeploy.id} deploy to finish (last status: ${status}).\n`,
          );
          process.exitCode = 2;
          return;
        }

        this.log(JSON.stringify(waitResult.function, null, 2));
        if (waitResult.kind === "failed") {
          const detail = waitResult.function.deploy_error
            ? `: ${waitResult.function.deploy_error}`
            : ".";
          process.stderr.write(
            `Function ${outcome.result.redeploy.id} deploy failed${detail}\n`,
          );
          process.exitCode = 1;
        }
        return;
      }

      this.log(JSON.stringify(outcome.result.redeploy, null, 2));
    });
  }
}

export default FunctionsRedeployCommand;
