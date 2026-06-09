import { Command, Flags } from "@oclif/core";
import type {
  CreateFunctionResult,
  FunctionDetail,
  FunctionSecretWriteResult,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import {
  createFunction,
  getFunction,
  getFunctionRouting,
  listFunctions,
  setFunctionSecret,
  updateFunction,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  readTextFileFlag,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import {
  DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS,
  DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS,
  type FunctionDeployWaitSnapshot,
  validateDeployWaitFlags,
  waitForFunctionDeploy,
} from "../function-deploy-wait.js";
import {
  collectSourceFiles,
  renderBuildFailure,
  runSourceDeploy,
  runSourceDeployWithSecrets,
  type SourceDeployWithSecretsApiSurface,
} from "../function-source.js";
import { emitRawSendMailFetchWarning } from "../lint/raw-send-mail-fetch.js";
import {
  resolveSecretFlags,
  SECRET_FLAG_SECURITY_NOTE,
  SECRET_SOURCE_FLAGS_DESCRIPTION,
  type SecretFlagPair,
} from "../secret-flags.js";

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
// Source maps follow the same shape via --source-map-file. The CLI
// reads the map from disk and sends it with the bundle so deploy
// diagnostics can map stack traces back to original source files.
//
// For full control (raw body, --raw-body JSON, etc.) the underlying
// `functions:create-function` operation stays available.
//
// Secret source flags are the one-call shortcut for "deploy a new
// function AND seed its secret bindings in the same command." After
// the create step the CLI writes each secret in order, then re-deploys
// with the SAME bundle so the running handler picks up the bindings.
// Without secrets the flow is a single create call; with one or more
// secrets the flow fans out to (create + N set-secret + redeploy) API
// calls.

// Tell the user whether the function reached "reachable" (route bound)
// or just "installed" (deployed but no route). AGX feedback: deploy was
// returning `deploy_status: deployed` and customers assumed inbound
// mail would now route to the function. It does not until a route is
// bound. Without this hint, the customer's first test invocation
// silently times out, even on the fast / happy path.
async function writeRouteStatusHint(
  apiClient: PrimitiveApiClient,
  functionId: string,
): Promise<void> {
  try {
    const result = await getFunctionRouting({
      client: apiClient.client,
      path: { id: functionId },
      responseStyle: "fields",
    });
    if (result.error) return;
    const routing = (result.data as { data?: unknown } | undefined)?.data;
    if (routing) {
      process.stderr.write(
        "Route bound. Function will receive inbound mail.\n",
      );
    } else {
      process.stderr.write(
        `Deployed but no route is bound. Inbound mail will not reach this function until you bind one: primitive functions route-set --id ${functionId} --domain <domain-id>  (or --fallback)\n`,
      );
    }
  } catch {
    // Routing hint is advisory only. A network blip here must not break
    // the deploy command's exit code.
  }
}

// Final payload runDeployWithSecrets produces on the happy path.
// `created` is the initial create result; `redeploy` is the
// updateFunction return value after secrets were written. When
// secrets are present the CLI prints `redeploy` (the state the
// user actually deployed); when no secrets are passed only
// `created` is set.
export type DeployWithSecretsResult = {
  created: CreateFunctionResult;
  secrets?: FunctionSecretWriteResult[];
  redeploy?: FunctionDetail;
};

// Minimal client surface runDeployWithSecrets needs. Factored out
// so the unit test can pass a fake without standing up a real
// PrimitiveApiClient or the generated fetch stack. The real
// implementation in run() passes thin wrappers around the
// generated SDK functions.
export type DeployApiSurface = {
  createFunction: (params: {
    name: string;
    code: string;
    sourceMap?: string;
  }) => Promise<{
    data?: { data?: CreateFunctionResult };
    error?: unknown;
  }>;
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

// Discriminated result from runDeployWithSecrets. The caller
// surfaces either a success (with the final result payload) or an
// error stage that identifies which step failed so run() can write
// stage-specific stderr hints. `succeededKeys` / `failedKey` are
// populated for `set-secret` failures so the hint can list which
// keys landed before the failure.
export type RunDeployWithSecretsResult =
  | { kind: "ok"; result: DeployWithSecretsResult }
  | {
      kind: "error";
      stage: "create";
      payload: unknown;
    }
  | {
      kind: "error";
      stage: "set-secret";
      payload: unknown;
      created: CreateFunctionResult;
      succeededKeys: string[];
      failedKey: string;
      pendingKeys: string[];
    }
  | {
      kind: "error";
      stage: "redeploy";
      payload: unknown;
      created: CreateFunctionResult;
      succeededKeys: string[];
    };

// Pure-ish orchestration of create + (optional secrets + redeploy).
// Mirrors runSetSecret in functions-set-secret.ts so the failure
// stages map directly onto stderr hints in run() below. Pulled out
// as a named export so the unit test can drive every branch with a
// fake DeployApiSurface, without spinning up a real client or the
// oclif command lifecycle.
export async function runDeployWithSecrets(
  api: DeployApiSurface,
  params: {
    name: string;
    code: string;
    sourceMap?: string;
    secrets: SecretFlagPair[];
  },
): Promise<RunDeployWithSecretsResult> {
  const createResult = await api.createFunction({
    code: params.code,
    name: params.name,
    ...(params.sourceMap !== undefined ? { sourceMap: params.sourceMap } : {}),
  });
  if (createResult.error) {
    return {
      kind: "error",
      payload: extractErrorPayload(createResult.error),
      stage: "create",
    };
  }
  const created = createResult.data?.data;
  if (!created) {
    return {
      kind: "error",
      payload: {
        code: "client_error",
        message: "Create function returned no data",
      },
      stage: "create",
    };
  }

  // Fast path: no secrets means no extra round-trips. The naked
  // create result is exactly what the pre-secrets-flag command
  // returned, so this branch is byte-identical to the previous
  // behavior.
  if (params.secrets.length === 0) {
    return { kind: "ok", result: { created } };
  }

  const writtenSecrets: FunctionSecretWriteResult[] = [];
  const succeededKeys: string[] = [];
  for (let i = 0; i < params.secrets.length; i++) {
    const pair = params.secrets[i];
    // Pre-compute the keys that come AFTER the current pair so a
    // set-secret failure can surface every key that was never
    // attempted, not just the one that failed. Without this, a user
    // following the recovery hint verbatim would re-run set-secret
    // only for the failed key and silently leave the trailing keys
    // un-written.
    const pendingKeys = params.secrets.slice(i + 1).map((p) => p.key);
    const setResult = await api.setSecret({
      id: created.id,
      key: pair.key,
      value: pair.value,
    });
    if (setResult.error) {
      return {
        created,
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
        created,
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
    id: created.id,
    ...(params.sourceMap !== undefined ? { sourceMap: params.sourceMap } : {}),
  });
  if (updateResult.error) {
    return {
      created,
      kind: "error",
      payload: extractErrorPayload(updateResult.error),
      stage: "redeploy",
      succeededKeys,
    };
  }
  const redeployed = updateResult.data?.data;
  if (!redeployed) {
    return {
      created,
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
    result: { created, redeploy: redeployed, secrets: writtenSecrets },
  };
}

class FunctionsDeployCommand extends Command {
  static description =
    `Deploy a new function from a bundled handler file. Agent-grade shortcut for functions:create-function.

  Reads the bundle off disk (--file) instead of forcing the caller to
  serialize the source into a JSON body. Use the underlying operation
  \`functions:create-function\` if you need the full flag surface
  (raw-body JSON, etc.).

  Pass secret source flags to seed bindings in the same command. Keys
  must match \`^[A-Z_][A-Z0-9_]*$\` (uppercase letters, digits,
  underscores; first character is a letter or underscore).

  With one or more secrets the deploy fans out to multiple API calls.
  For --file (and for --source when no function with the given name
  exists yet): create-function, set-secret per pair, then a final
  update-function so the running handler picks up the bindings. For
  --source against an existing function name: the create-function step
  is replaced by an id lookup, then set-secret per pair, then a single
  update-function that binds the new code and the new secret env in
  one step (avoiding an intermediate redeploy that would briefly run
  the new code with the previous secret bindings).

  If a secret write fails before the final redeploy, the function row
  carries whatever bindings landed but the running handler has NOT yet
  picked them up. Re-run \`primitive functions set-secret\` for the
  missing keys, then re-run \`primitive functions deploy\` (or
  \`functions redeploy\`) to push them live. ${SECRET_SOURCE_FLAGS_DESCRIPTION}`;

  static summary = "Deploy a new function from a bundled handler file";

  static examples = [
    "<%= config.bin %> functions deploy --name forwarder --file ./bundle.js",
    "<%= config.bin %> functions deploy --name triage --source ./triage-agent",
    "<%= config.bin %> functions deploy --name triage --source . --wait",
    "<%= config.bin %> functions deploy --name forwarder --file ./bundle.js --wait",
    "<%= config.bin %> functions deploy --name forwarder --file ./bundle.js --source-map-file ./bundle.js.map",
    "<%= config.bin %> functions deploy --name forwarder --file ./bundle.js --secret OPENAI_KEY=sk-... --secret OWNER_EMAIL=me@example.com",
    "<%= config.bin %> functions deploy --name forwarder --file ./bundle.js --secret-from-env OPENAI_KEY --secret-from-env-file .env.local:OWNER_EMAIL",
    "<%= config.bin %> functions deploy --name triage --source . --secret-from-env ANTHROPIC_API_KEY",
    "printf '%s' \"$OPENAI_KEY\" | <%= config.bin %> functions deploy --name forwarder --file ./bundle.js --secret-from-stdin OPENAI_KEY",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    name: Flags.string({
      description:
        "Slug-style name. Lowercase letters, digits, hyphens, underscores. 1-64 chars. Must be unique within the org.",
      required: true,
    }),
    file: Flags.string({
      description:
        "Path to the bundled ESM handler file (single self-contained module). Loaded as the `code` body field. Exactly one of --file or --source is required.",
    }),
    source: Flags.string({
      description:
        "Path to a project directory (containing package.json and src/) to deploy via managed build: the source is uploaded and the server installs dependencies, bundles for the Workers runtime, and deploys. Idempotent by name (creates the function, or redeploys it if --name already exists), so it is safe to run on every push. Exactly one of --file or --source is required.",
    }),
    "source-map-file": Flags.string({
      description:
        "Optional path to a source map for the bundle. Stored with the deployment attempt and used to symbolicate stack traces in function logs.",
    }),
    secret: Flags.string({
      description: `Secret KEY=VALUE to seed on the deployed function. Repeatable. KEY must match \`^[A-Z_][A-Z0-9_]*$\`; VALUE may contain \`=\` (only the first \`=\` is treated as a delimiter). Each KEY may only appear once per command. Passing one or more --secret flags fans out the deploy to create-function, set-secret per pair, then a final redeploy so the running handler picks up the bindings. ${SECRET_FLAG_SECURITY_NOTE}`,
      multiple: true,
    }),
    "secret-from-env": Flags.string({
      description:
        "Secret KEY to read from the environment and seed on the deployed function. Repeatable. Example: --secret-from-env OPENAI_KEY reads process.env.OPENAI_KEY.",
      multiple: true,
    }),
    "secret-from-file": Flags.string({
      description:
        "Secret KEY=PATH to read from a UTF-8 file and seed on the deployed function. Repeatable. The full file contents become the value.",
      multiple: true,
    }),
    "secret-from-env-file": Flags.string({
      description:
        "Secret FILE:KEY to read from a dotenv-style file and seed on the deployed function. Repeatable. Example: --secret-from-env-file .env.local:OPENAI_KEY.",
      multiple: true,
    }),
    "secret-from-stdin": Flags.string({
      description:
        "Secret KEY to read from stdin and seed on the deployed function. A single trailing line ending is stripped. Stdin is consumed once, so this flag is not repeatable.",
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
    const { flags } = await this.parse(FunctionsDeployCommand);

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

      // Exactly one input mode: a pre-built bundle (--file) or a project
      // directory built server-side (--source).
      if ((flags.file === undefined) === (flags.source === undefined)) {
        process.stderr.write(
          "Provide exactly one of --file (a pre-built bundle) or --source (a project directory for managed build).\n",
        );
        process.exitCode = 1;
        return;
      }

      if (flags.source !== undefined) {
        await this.runSourceMode(flags, flags.source);
        return;
      }

      const file = flags.file;
      if (file === undefined) return;

      // Validate --secret pairs BEFORE any disk read or API call so
      // a malformed input fails fast with a clear error and zero
      // side effects. The fast path (no --secret flags) skips this
      // entirely.
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

      // Reads are inside the timed block so --time captures disk I/O
      // alongside the API call. A pathological filesystem (NFS, slow
      // FUSE mount) showing up here is exactly the kind of latency
      // surprise --time is meant to surface.
      const code = readTextFileFlag(file, "--file");
      const sourceMap = flags["source-map-file"]
        ? readTextFileFlag(flags["source-map-file"], "--source-map-file")
        : undefined;

      // Non-blocking deploy-time lint: if the bundle has a raw
      // fetch(...) call against /send-mail, nudge the author toward
      // `createPrimitiveClient` from `@primitivedotdev/sdk/api`.
      // The warning lands on stderr so it never contaminates the
      // JSON stdout the caller may pipe into jq.
      emitRawSendMailFetchWarning(code, (chunk) => process.stderr.write(chunk));

      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
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
      const apiSurface: DeployApiSurface = {
        createFunction: (p) =>
          createFunction({
            body: {
              code: p.code,
              name: p.name,
              ...(p.sourceMap !== undefined ? { sourceMap: p.sourceMap } : {}),
            },
            client: apiClient.client,
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
            body: {
              code: p.code,
              ...(p.sourceMap !== undefined ? { sourceMap: p.sourceMap } : {}),
            },
            client: apiClient.client,
            path: { id: p.id },
            responseStyle: "fields",
          }),
      };

      const outcome = await runDeployWithSecrets(apiSurface, {
        code,
        name: flags.name,
        secrets: parsedSecrets.secrets,
        ...(sourceMap !== undefined ? { sourceMap } : {}),
      });

      if (outcome.kind === "error") {
        // Stage-specific framing on stderr so callers can tell
        // whether the function was created before a downstream
        // failure left it without secrets or without the
        // redeploy. The JSON envelope still goes through
        // writeErrorWithHints so any actionable hint (e.g.
        // unauthorized) is surfaced.
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
            `Function ${outcome.created.name} (${outcome.created.id}) was created, but writing secret ${outcome.failedKey} failed; succeeded keys so far: ${succeeded}; keys not yet attempted: ${pending}. The redeploy is NOT yet live. Re-run \`primitive functions set-secret\` for each of [${allMissing}], then \`primitive functions redeploy --id ${outcome.created.id} --file <bundle>\` to push them live.\n`,
          );
        } else if (outcome.stage === "redeploy") {
          const succeeded =
            outcome.succeededKeys.length > 0
              ? outcome.succeededKeys.join(", ")
              : "(none)";
          process.stderr.write(
            `Function ${outcome.created.name} (${outcome.created.id}) was created and secrets [${succeeded}] were written, but the final redeploy failed; the new bindings are NOT yet live. Re-run \`primitive functions redeploy --id ${outcome.created.id} --file <bundle>\` once the cause is fixed.\n`,
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

      // On the happy path, prefer the redeployed FunctionDetail
      // (when secrets fired) over the bare CreateFunctionResult,
      // since the redeploy is the state the user actually
      // deployed. When no secrets were passed, fall back to the
      // create payload for byte-identical pre-flag behavior.
      const payload = outcome.result.redeploy ?? outcome.result.created;
      if (flags.wait) {
        const waitResult = await waitForFunctionDeploy({
          getFunction: (p) =>
            getFunction({
              client: apiClient.client,
              path: { id: p.id },
              responseStyle: "fields",
            }),
          id: payload.id,
          initial: payload,
          pollIntervalSeconds: flags["poll-interval"],
          timeoutSeconds: flags.timeout,
          writeStderr: (chunk) => process.stderr.write(chunk),
        });

        if (waitResult.kind === "error") {
          writeErrorWithHints(waitResult.payload);
          surfaceUnauthorizedHint({
            ...authFailureContext,
            payload: waitResult.payload,
          });
          process.exitCode = 1;
          return;
        }

        if (waitResult.kind === "timeout") {
          const status = waitResult.lastFunction?.deploy_status ?? "unknown";
          process.stderr.write(
            `Timed out after ${flags.timeout}s waiting for function ${payload.id} deploy to finish (last status: ${status}).\n`,
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
            `Function ${payload.id} deploy failed${detail}\n`,
          );
          process.exitCode = 1;
        } else {
          await writeRouteStatusHint(apiClient, payload.id);
        }
        return;
      }

      this.log(JSON.stringify(payload, null, 2));
      await writeRouteStatusHint(apiClient, payload.id);
    });
  }

  // Managed-build deploy from a project directory. Collects the source,
  // then idempotently creates or redeploys the function by name. When
  // secret-source flags are passed:
  //   * If the function does NOT exist, mirrors the --file path:
  //     createFunction(files) → setSecret per pair → final
  //     updateFunction(files) to bind the secrets into the running handler.
  //   * If the function ALREADY exists, SKIPS the intermediate redeploy:
  //     setSecret per pair → single final updateFunction(files) that binds
  //     new code + new secret env atomically. Writing secrets before the
  //     redeploy avoids briefly running the new code with the prior
  //     secret bindings (workers snapshot secret env at deploy time).
  private async runSourceMode(
    flags: {
      "api-key"?: string;
      "api-base-url"?: string;
      name: string;
      secret?: string[];
      "secret-from-env"?: string[];
      "secret-from-file"?: string[];
      "secret-from-env-file"?: string[];
      "secret-from-stdin"?: string;
      wait?: boolean;
      timeout: number;
      "poll-interval": number;
    },
    sourceDir: string,
  ): Promise<void> {
    // Validate secret pairs BEFORE collecting source or touching the API
    // so malformed input fails fast with zero side effects. The no-secret
    // path skips straight through with an empty result.
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

    const collected = collectSourceFiles(sourceDir);
    if (collected.kind === "error") {
      process.stderr.write(`${collected.message}\n`);
      process.exitCode = 1;
      return;
    }

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });
    const authFailureContext = {
      auth,
      baseUrlOverridden,
      configDir: this.config.configDir,
    };

    const apiSurface: SourceDeployWithSecretsApiSurface = {
      createFunction: (p) =>
        createFunction({
          body: { files: p.files, name: p.name },
          client: apiClient.client,
          responseStyle: "fields",
        }),
      listFunctions: () =>
        listFunctions({
          client: apiClient.client,
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
          body: { files: p.files },
          client: apiClient.client,
          path: { id: p.id },
          responseStyle: "fields",
        }),
    };

    // Fast path: no secrets means a single create-or-redeploy round-trip,
    // byte-identical to the pre-flag behavior. The secrets path adds a
    // setSecret loop + a final redeploy on top.
    if (parsedSecrets.secrets.length === 0) {
      const outcome = await runSourceDeploy(apiSurface, {
        files: collected.files,
        name: flags.name,
      });
      if (outcome.kind === "error") {
        renderBuildFailure(outcome.payload, (chunk) =>
          process.stderr.write(chunk),
        );
        writeErrorWithHints(outcome.payload);
        surfaceUnauthorizedHint({
          ...authFailureContext,
          payload: outcome.payload,
        });
        process.exitCode = 1;
        return;
      }
      await this.finishSourceDeploy({
        apiClient,
        authFailureContext,
        flags,
        payload: outcome.result,
      });
      return;
    }

    const secretsOutcome = await runSourceDeployWithSecrets(apiSurface, {
      files: collected.files,
      name: flags.name,
      secrets: parsedSecrets.secrets,
    });

    if (secretsOutcome.kind === "error") {
      // Stage-specific framing on stderr so callers can tell whether the
      // function was created before a downstream failure left it without
      // secrets or without the final redeploy. The JSON envelope still
      // goes through writeErrorWithHints so any actionable hint (e.g.
      // unauthorized) is surfaced.
      if (secretsOutcome.stage === "set-secret") {
        const succeeded =
          secretsOutcome.succeededKeys.length > 0
            ? secretsOutcome.succeededKeys.join(", ")
            : "(none)";
        const pending =
          secretsOutcome.pendingKeys.length > 0
            ? secretsOutcome.pendingKeys.join(", ")
            : "(none)";
        const allMissing = [
          secretsOutcome.failedKey,
          ...secretsOutcome.pendingKeys,
        ].join(", ");
        const createdClause = secretsOutcome.created
          ? `Function ${secretsOutcome.created.name} (${secretsOutcome.functionId}) was created`
          : `Function ${flags.name} (${secretsOutcome.functionId}) already existed`;
        // Atomicity warning: succeededKeys are now staged on the function row
        // and will become live on the NEXT deploy of this function (even one
        // a colleague triggers, and even one that does not pass --secret).
        // Call that out so a partial write does not silently arm new bindings
        // on an unrelated future redeploy.
        const stagingWarning =
          secretsOutcome.succeededKeys.length > 0
            ? ` Note: [${succeeded}] are now staged on the function row and will bind on the next deploy of this function (including one that does not pass --secret).`
            : "";
        process.stderr.write(
          `${createdClause}, but writing secret ${secretsOutcome.failedKey} failed; succeeded keys so far: ${succeeded}; keys not yet attempted: ${pending}. The redeploy is NOT yet live. Re-run \`primitive functions set-secret\` for each of [${allMissing}], then \`primitive functions deploy --source ${sourceDir} --name ${flags.name}\` to push them live.${stagingWarning}\n`,
        );
      } else if (secretsOutcome.stage === "secret-redeploy") {
        const succeeded =
          secretsOutcome.succeededKeys.length > 0
            ? secretsOutcome.succeededKeys.join(", ")
            : "(none)";
        const createdClause = secretsOutcome.created
          ? `Function ${secretsOutcome.created.name} (${secretsOutcome.functionId}) was created and`
          : `Function ${flags.name} (${secretsOutcome.functionId}) already existed and`;
        process.stderr.write(
          `${createdClause} secrets [${succeeded}] were written, but the final redeploy failed; the new bindings are NOT yet live. Re-run \`primitive functions deploy --source ${sourceDir} --name ${flags.name}\` once the cause is fixed.\n`,
        );
      } else {
        renderBuildFailure(secretsOutcome.payload, (chunk) =>
          process.stderr.write(chunk),
        );
      }
      writeErrorWithHints(secretsOutcome.payload);
      surfaceUnauthorizedHint({
        ...authFailureContext,
        payload: secretsOutcome.payload,
      });
      process.exitCode = 1;
      return;
    }

    // Prefer the redeployed FunctionDetail over the initial create payload,
    // since the redeploy is the state the user actually deployed (it's the
    // first deploy where the new secret bindings are live).
    await this.finishSourceDeploy({
      apiClient,
      authFailureContext,
      flags,
      payload: secretsOutcome.result.redeploy,
    });
  }

  // Common --wait + write-route-hint tail for the two source-mode paths
  // (with and without secret flags). Identical to the body the original
  // single-path runSourceMode ran after a successful runSourceDeploy.
  private async finishSourceDeploy(args: {
    apiClient: Awaited<
      ReturnType<typeof createAuthenticatedCliApiClient>
    >["apiClient"];
    authFailureContext: {
      auth: Awaited<ReturnType<typeof createAuthenticatedCliApiClient>>["auth"];
      baseUrlOverridden: boolean;
      configDir: string;
    };
    flags: {
      wait?: boolean;
      timeout: number;
      "poll-interval": number;
    };
    payload: FunctionDeployWaitSnapshot;
  }): Promise<void> {
    const { apiClient, authFailureContext, flags, payload } = args;
    if (flags.wait) {
      const waitResult = await waitForFunctionDeploy({
        getFunction: (p) =>
          getFunction({
            client: apiClient.client,
            path: { id: p.id },
            responseStyle: "fields",
          }),
        id: payload.id,
        initial: payload,
        pollIntervalSeconds: flags["poll-interval"],
        timeoutSeconds: flags.timeout,
        writeStderr: (chunk) => process.stderr.write(chunk),
      });
      if (waitResult.kind === "error") {
        writeErrorWithHints(waitResult.payload);
        surfaceUnauthorizedHint({
          ...authFailureContext,
          payload: waitResult.payload,
        });
        process.exitCode = 1;
        return;
      }
      if (waitResult.kind === "timeout") {
        const status = waitResult.lastFunction?.deploy_status ?? "unknown";
        process.stderr.write(
          `Timed out after ${flags.timeout}s waiting for function ${payload.id} deploy to finish (last status: ${status}).\n`,
        );
        process.exitCode = 2;
        return;
      }
      this.log(JSON.stringify(waitResult.function, null, 2));
      if (waitResult.kind === "failed") {
        const detail = waitResult.function.deploy_error
          ? `: ${waitResult.function.deploy_error}`
          : ".";
        process.stderr.write(`Function ${payload.id} deploy failed${detail}\n`);
        process.exitCode = 1;
      } else {
        await writeRouteStatusHint(apiClient, payload.id);
      }
      return;
    }

    this.log(JSON.stringify(payload, null, 2));
    await writeRouteStatusHint(apiClient, payload.id);
  }
}

export default FunctionsDeployCommand;
