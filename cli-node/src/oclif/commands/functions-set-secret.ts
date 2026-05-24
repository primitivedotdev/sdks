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
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import type { ResolvedCliAuth } from "../auth.js";
import {
  resolveSingleSecretValue,
  SINGLE_SECRET_VALUE_SOURCE_DESCRIPTION,
} from "../secret-flags.js";

// `primitive functions:set-secret` is the agent-grade shortcut for
// writing a function secret and (optionally) pushing it live in the
// same call. The underlying `functions:set-function-secret` /
// `functions:create-function-secret` operations only do the secret
// upsert; making the new value visible to the running handler
// requires a separate `functions:redeploy` (or `functions:update-
// function`) call with the existing bundle. AGX walkthrough flagged
// the two-step dance as tedious: passing `--redeploy` here collapses
// it into one command.
//
// Shape:
//   primitive functions:set-secret --id <fn-id> --key <KEY> --value <value>
//   primitive functions:set-secret --id <fn-id> --key <KEY> --value-from-env <KEY> --redeploy
//   primitive functions:set-secret --id <fn-id> --key <KEY> --value-from-env-file .env.local --redeploy
//   printf '%s' "$VALUE" | primitive functions:set-secret --id <fn-id> --key <KEY> --stdin --redeploy
//
// The raw `functions:set-function-secret` and `functions:create-
// function-secret` operations stay available for callers that want
// the unsugared form.
//
// Source map behavior for --redeploy: the redeploy step pulls the
// function's current live code via getFunction and re-uploads it
// without a sourceMap field. The API preserves the current stored
// source map when the code matches, so secret-only redeploys keep
// stack-trace symbolication. To replace or restore a map, use
// `functions:redeploy --file <bundle> --source-map-file <map>`.

// Shape of the API result the redeploy step returns. Exported only
// so the unit test for runSetSecret can construct one in fake
// fixtures without redefining the structure.
export type SetSecretResult = {
  secret: FunctionSecretWriteResult;
  redeploy?: FunctionDetail;
};

// Minimal client surface runSetSecret needs. Factored out so the
// unit test can pass a fake without standing up a real
// PrimitiveApiClient or the generated fetch stack. The real
// implementation in run() passes thin wrappers around the
// generated SDK functions.
export type SetSecretApiSurface = {
  setSecret: (params: { id: string; key: string; value: string }) => Promise<{
    data?: { data?: FunctionSecretWriteResult };
    error?: unknown;
  }>;
  getFunction: (params: { id: string }) => Promise<{
    data?: { data?: FunctionDetail };
    error?: unknown;
  }>;
  updateFunction: (params: { id: string; code: string }) => Promise<{
    data?: { data?: FunctionDetail };
    error?: unknown;
  }>;
};

// Discriminated result from runSetSecret. The caller surfaces
// either a success (with the secret write payload and the optional
// redeploy detail) or an error stage that identifies which step
// failed so the CLI run() handler can write hints + clean up
// credentials without re-deriving the failure source.
export type RunSetSecretResult =
  | { kind: "ok"; result: SetSecretResult }
  | {
      kind: "error";
      stage: "set-secret" | "get-function" | "redeploy";
      payload: unknown;
    };

// Pure-ish orchestration of the set-secret + optional redeploy
// flow. Pulled out as a named export so the unit test can drive
// both the happy path and each error stage with a fake API
// surface, without spinning up a real client or the oclif
// command lifecycle.
//
// The redeploy step uses the function's CURRENT code (fetched via
// getFunction) as the new bundle. This is the documented way to
// "refresh secret bindings without changing the handler": the
// server-side deploy reads the secrets table fresh on every call,
// so re-deploying the same code picks up the secret we just wrote.
export async function runSetSecret(
  api: SetSecretApiSurface,
  params: { id: string; key: string; value: string; redeploy: boolean },
): Promise<RunSetSecretResult> {
  const setResult = await api.setSecret({
    id: params.id,
    key: params.key,
    value: params.value,
  });
  if (setResult.error) {
    return {
      kind: "error",
      payload: extractErrorPayload(setResult.error),
      stage: "set-secret",
    };
  }
  const secret = setResult.data?.data;
  if (!secret) {
    // Server returned 2xx with no `data` body. Treat as an error
    // so we don't fabricate a success payload; this should not
    // happen in practice but the shape forces us to handle it.
    return {
      kind: "error",
      payload: {
        code: "client_error",
        message: "Secret write returned no data",
      },
      stage: "set-secret",
    };
  }

  if (!params.redeploy) {
    return { kind: "ok", result: { secret } };
  }

  const fnResult = await api.getFunction({ id: params.id });
  if (fnResult.error) {
    return {
      kind: "error",
      payload: extractErrorPayload(fnResult.error),
      stage: "get-function",
    };
  }
  const fn = fnResult.data?.data;
  if (!fn) {
    return {
      kind: "error",
      payload: {
        code: "client_error",
        message: "Could not read current function code for redeploy",
      },
      stage: "get-function",
    };
  }

  const updateResult = await api.updateFunction({
    code: fn.code,
    id: params.id,
  });
  if (updateResult.error) {
    return {
      kind: "error",
      payload: extractErrorPayload(updateResult.error),
      stage: "redeploy",
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
    };
  }

  return { kind: "ok", result: { redeploy: redeployed, secret } };
}

class FunctionsSetSecretCommand extends Command {
  static description =
    `Write a function secret and optionally redeploy so the new value lands in the running handler. Agent-grade shortcut for functions set-function-secret + functions redeploy.

  Without --redeploy this is a plain secret upsert: the value is
  encrypted at rest but is NOT visible to the running handler until
  the next deploy. Pass --redeploy to re-run the deploy with the
  function's current code in the same call, which refreshes the
  binding set with the value you just wrote.

  Keys must match \`^[A-Z_][A-Z0-9_]*$\` (uppercase letters, digits,
  underscores; first character is a letter or underscore). System-
  managed keys are reserved and rejected. ${SINGLE_SECRET_VALUE_SOURCE_DESCRIPTION}`;

  static summary =
    "Write a function secret (optionally redeploying to push it live)";

  static examples = [
    "<%= config.bin %> functions set-secret --id <fn-id> --key API_TOKEN --value abc123",
    "<%= config.bin %> functions set-secret --id <fn-id> --key API_TOKEN --value abc123 --redeploy",
    "<%= config.bin %> functions set-secret --id <fn-id> --key OPENAI_KEY --value-from-env OPENAI_KEY --redeploy",
    "<%= config.bin %> functions set-secret --id <fn-id> --key OPENAI_KEY --value-from-env-file .env.local --redeploy",
    "printf '%s' \"$OPENAI_KEY\" | <%= config.bin %> functions set-secret --id <fn-id> --key OPENAI_KEY --stdin --redeploy",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
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
    key: Flags.string({
      description:
        "Secret key. Uppercase letters, digits, underscores; must start with a letter or underscore. System-managed keys are reserved.",
      required: true,
    }),
    value: Flags.string({
      description:
        "Secret value (up to 4096 UTF-8 bytes). Encrypted at rest. Visible in shell history and process argv; prefer a non-argv source for sensitive values.",
    }),
    "value-from-env": Flags.string({
      description:
        "Environment variable to read as the secret value. Example: --value-from-env OPENAI_KEY reads process.env.OPENAI_KEY.",
    }),
    "value-file": Flags.string({
      description:
        "UTF-8 file to read as the secret value. The full file contents become the value.",
    }),
    "value-from-env-file": Flags.string({
      description:
        "Dotenv-style file to read as the secret value. Use FILE to read --key from that file, or FILE:KEY to read a different key.",
    }),
    stdin: Flags.boolean({
      description:
        "Read the secret value from stdin. A single trailing line ending is stripped. Example: printf '%s' \"$OPENAI_KEY\" | primitive functions set-secret --id <fn-id> --key OPENAI_KEY --stdin",
    }),
    redeploy: Flags.boolean({
      description:
        "Also redeploy the function with its current code so the new value lands in the running handler. Without this, the secret is written but not visible to the handler until the next deploy. Note: when --redeploy re-uploads the function's current live code without a sourceMap field, the API preserves the current stored source map. Use `functions redeploy --file <bundle.js> --source-map-file <bundle.js.map>` to replace or restore a map.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FunctionsSetSecretCommand);

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl1: flags["api-base-url-1"],
          apiBaseUrl2: flags["api-base-url-2"],
          configDir: this.config.configDir,
        });

      const authFailureContext: {
        auth: ResolvedCliAuth;
        baseUrlOverridden: boolean;
        configDir: string;
      } = {
        auth,
        baseUrlOverridden,
        configDir: this.config.configDir,
      };

      const resolvedValue = resolveSingleSecretValue({
        key: flags.key,
        value: flags.value,
        valueFile: flags["value-file"],
        valueFromEnv: flags["value-from-env"],
        valueFromEnvFile: flags["value-from-env-file"],
        stdin: flags.stdin,
      });
      if (resolvedValue.kind === "error") {
        process.stderr.write(`${resolvedValue.message}\n`);
        process.exitCode = 1;
        return;
      }

      // Adapter: thin wrappers around the generated SDK calls,
      // routed through host 1 (apiClient.client). The secrets and
      // function-detail endpoints are not on host 2.
      const apiSurface: SetSecretApiSurface = {
        getFunction: (p) =>
          getFunction({
            client: apiClient.client,
            path: { id: p.id },
            responseStyle: "fields",
          }),
        setSecret: (p) =>
          setFunctionSecret({
            body: { value: p.value },
            client: apiClient.client,
            path: { id: p.id, key: p.key },
            responseStyle: "fields",
          }),
        updateFunction: (p) =>
          updateFunction({
            body: { code: p.code },
            client: apiClient.client,
            path: { id: p.id },
            responseStyle: "fields",
          }),
      };

      const outcome = await runSetSecret(apiSurface, {
        id: flags.id,
        key: flags.key,
        redeploy: flags.redeploy === true,
        value: resolvedValue.value,
      });

      if (outcome.kind === "error") {
        // Stage-specific framing on stderr so callers can tell
        // whether the secret landed before a failed redeploy. The
        // JSON envelope still goes through writeErrorWithHints so
        // any actionable hint (e.g. unauthorized) is surfaced.
        if (outcome.stage === "get-function") {
          process.stderr.write(
            "Secret was written, but reading current function code for redeploy failed; the secret is NOT yet live. Re-run with --redeploy, or call `primitive functions redeploy --id <id> --file <bundle>` once you have the bundle.\n",
          );
        } else if (outcome.stage === "redeploy") {
          process.stderr.write(
            "Secret was written, but the redeploy step failed; the secret is NOT yet live. Inspect the function's deploy_error and re-run `primitive functions redeploy --id <id> --file <bundle>` once the cause is fixed.\n",
          );
        }
        writeErrorWithHints(outcome.payload);
        surfaceUnauthorizedHint({
          ...authFailureContext,
          payload: outcome.payload,
        });
        process.exitCode = 1;
        return;
      }

      this.log(JSON.stringify(outcome.result, null, 2));
    });
  }
}

export default FunctionsSetSecretCommand;
