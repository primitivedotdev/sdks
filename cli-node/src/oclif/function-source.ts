import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type {
  CreateFunctionResult,
  FunctionDetail,
  FunctionListItem,
  FunctionSecretWriteResult,
} from "@primitivedotdev/api-core";
import { extractErrorPayload } from "./api-command.js";
import type { SecretFlagPair } from "./secret-flags.js";

// Source-deploy (managed build): instead of uploading a pre-built bundle
// (--file), the CLI ships the project's source (--source <dir>) and the
// server installs dependencies, bundles for the Workers runtime, and
// deploys. This file holds the two testable pieces: collecting the source
// directory into a files map, and the create-or-redeploy orchestration.

export type SourceCollectionResult =
  | { kind: "ok"; files: Record<string, string> }
  | { kind: "error"; message: string };

// Collect what a managed build needs from a project directory: package.json
// (required) plus everything under src/. devDependencies are stripped from
// the shipped package.json since the build installs only runtime
// dependencies. Paths use forward slashes (the builder runs on Linux).
export function collectSourceFiles(dir: string): SourceCollectionResult {
  let pkgRaw: string;
  try {
    pkgRaw = readFileSync(join(dir, "package.json"), "utf8");
  } catch {
    return {
      kind: "error",
      message: `No package.json found in ${dir}. A managed build needs a package.json (its "dependencies" are installed).`,
    };
  }
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
  } catch (error) {
    return {
      kind: "error",
      message: `package.json in ${dir} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  delete pkg.devDependencies;

  const files: Record<string, string> = {
    "package.json": `${JSON.stringify(pkg, null, 2)}\n`,
  };

  const srcDir = join(dir, "src");
  if (isDirectory(srcDir)) {
    for (const abs of walk(srcDir)) {
      files[relative(dir, abs).split(sep).join("/")] = readFileSync(
        abs,
        "utf8",
      );
    }
  }

  if (Object.keys(files).length === 1) {
    return {
      kind: "error",
      message: `No source files found under ${srcDir}. Put your handler at src/index.ts.`,
    };
  }
  return { kind: "ok", files };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(abs);
    } else {
      yield abs;
    }
  }
}

// Minimal client surface runSourceDeploy needs. Factored out so the unit
// test can drive every branch with a fake, without a real client.
export type SourceDeployApiSurface = {
  listFunctions: () => Promise<{
    data?: { data?: FunctionListItem[] };
    error?: unknown;
  }>;
  createFunction: (params: {
    name: string;
    files: Record<string, string>;
  }) => Promise<{ data?: { data?: CreateFunctionResult }; error?: unknown }>;
  updateFunction: (params: {
    id: string;
    files: Record<string, string>;
  }) => Promise<{ data?: { data?: FunctionDetail }; error?: unknown }>;
};

// runSourceDeployWithSecrets needs everything runSourceDeploy does plus a
// setSecret method. Keeping these on separate types means the no-secrets
// caller doesn't have to wire (or stub) setSecret, and the orchestrator
// never has to defensively guard against a missing method at runtime.
export type SourceDeployWithSecretsApiSurface = SourceDeployApiSurface & {
  setSecret: (params: { id: string; key: string; value: string }) => Promise<{
    data?: { data?: FunctionSecretWriteResult };
    error?: unknown;
  }>;
};

export type RunSourceDeployResult =
  | { kind: "ok"; action: "created"; result: CreateFunctionResult }
  | { kind: "ok"; action: "redeployed"; result: FunctionDetail }
  | {
      kind: "error";
      stage: "lookup" | "create" | "redeploy";
      payload: unknown;
    };

// Idempotent deploy-from-source: look the function up by name in the
// functions list and redeploy it, or create it if it does not exist. This
// is what makes `deploy --source` safe to run on every push (e.g. from CI)
// without tracking the function id. The list endpoint returns every
// function in one response, so no pagination is needed.
export async function runSourceDeploy(
  api: SourceDeployApiSurface,
  params: { name: string; files: Record<string, string> },
): Promise<RunSourceDeployResult> {
  const listed = await api.listFunctions();
  if (listed.error) {
    return {
      kind: "error",
      payload: extractErrorPayload(listed.error),
      stage: "lookup",
    };
  }
  const foundId =
    (listed.data?.data ?? []).find((f) => f.name === params.name)?.id ?? null;

  if (foundId !== null) {
    const updated = await api.updateFunction({
      files: params.files,
      id: foundId,
    });
    if (updated.error) {
      return {
        kind: "error",
        payload: extractErrorPayload(updated.error),
        stage: "redeploy",
      };
    }
    const data = updated.data?.data;
    if (!data) {
      return {
        kind: "error",
        payload: { code: "client_error", message: "Redeploy returned no data" },
        stage: "redeploy",
      };
    }
    return { action: "redeployed", kind: "ok", result: data };
  }

  const created = await api.createFunction({
    files: params.files,
    name: params.name,
  });
  if (created.error) {
    return {
      kind: "error",
      payload: extractErrorPayload(created.error),
      stage: "create",
    };
  }
  const data = created.data?.data;
  if (!data) {
    return {
      kind: "error",
      payload: { code: "client_error", message: "Create returned no data" },
      stage: "create",
    };
  }
  return { action: "created", kind: "ok", result: data };
}

// Final payload runSourceDeployWithSecrets produces on the happy path.
// `secrets` is the list of secret writes that landed. `redeploy` is the
// final updateFunction call that bound those secrets into the running
// handler. This is what the CLI prints back to the user as the deployed state.
export type SourceDeployWithSecretsResult = {
  action: "created" | "redeployed";
  secrets: FunctionSecretWriteResult[];
  redeploy: FunctionDetail;
};

// Discriminated result for runSourceDeployWithSecrets. Stages map to the
// API calls in order so the caller can write a stage-specific stderr hint
// ("created but secret X failed", "secrets written but final redeploy
// failed", etc).
//
// `created` is populated on set-secret / secret-redeploy errors that follow a
// successful create, so the hint can include the function id the user needs to
// rerun set-secret + redeploy against. It is intentionally undefined on
// errors against a function that already existed: there was no fresh create
// to surface, the function id is already known, and the user's existing
// function row is unchanged.
export type RunSourceDeployWithSecretsResult =
  | { kind: "ok"; result: SourceDeployWithSecretsResult }
  | {
      kind: "error";
      stage: "lookup" | "create";
      payload: unknown;
    }
  | {
      kind: "error";
      stage: "set-secret";
      payload: unknown;
      functionId: string;
      created?: CreateFunctionResult;
      succeededKeys: string[];
      failedKey: string;
      pendingKeys: string[];
    }
  | {
      kind: "error";
      stage: "secret-redeploy";
      payload: unknown;
      functionId: string;
      created?: CreateFunctionResult;
      succeededKeys: string[];
    };

// Idempotent source deploy that also seeds secret bindings in one command.
// Mirrors runDeployWithSecrets's pattern for --file deploys.
//
// Two paths:
//
//   1. Function does NOT exist. Call createFunction(files) first so a
//      function row + initial code state exists for setSecret to write
//      against; the create's deploy_status is the user's "I have a function"
//      signal. Then write each secret, then updateFunction(files) again so
//      the running handler picks up the new bindings. This matches
//      runDeployWithSecrets exactly (createFunction with code → setSecret →
//      updateFunction with code).
//
//   2. Function ALREADY exists. SKIP an initial redeploy entirely. The user
//      may be pushing new code AND updating secrets in one call; doing an
//      intermediate updateFunction(files) before writing secrets would run
//      the new code briefly with old secret bindings (workers read their
//      secret env at deploy time, so the redeploy would snapshot the
//      pre-update secret values). Writing secrets first means the single
//      updateFunction at the end is the ONLY redeploy and it picks up both
//      the new code and the new secret values atomically.
//
// On set-secret failure the orchestrator stops without calling the final
// updateFunction. Note that the secrets that DID land are now staged on the
// function row: they will become live on the very next deploy of this
// function, even one triggered by another caller or one that does not pass
// any --secret flag. Callers should surface that to the operator so a
// partial-write does not silently arm new bindings on an unrelated future
// deploy. Recovery is `functions set-secret` for the missing keys followed
// by a re-run of this command (or `functions redeploy`).
export async function runSourceDeployWithSecrets(
  api: SourceDeployWithSecretsApiSurface,
  params: {
    name: string;
    files: Record<string, string>;
    secrets: SecretFlagPair[];
  },
): Promise<RunSourceDeployWithSecretsResult> {
  const listed = await api.listFunctions();
  if (listed.error) {
    return {
      kind: "error",
      payload: extractErrorPayload(listed.error),
      stage: "lookup",
    };
  }
  const foundId =
    (listed.data?.data ?? []).find((f) => f.name === params.name)?.id ?? null;

  let functionId: string;
  let createPayload: CreateFunctionResult | undefined;
  if (foundId === null) {
    const created = await api.createFunction({
      files: params.files,
      name: params.name,
    });
    if (created.error) {
      return {
        kind: "error",
        payload: extractErrorPayload(created.error),
        stage: "create",
      };
    }
    const data = created.data?.data;
    if (!data) {
      return {
        kind: "error",
        payload: { code: "client_error", message: "Create returned no data" },
        stage: "create",
      };
    }
    functionId = data.id;
    createPayload = data;
  } else {
    // Existing function: take its id as-is and skip the intermediate
    // redeploy. The final updateFunction below is the single redeploy
    // that pushes new code + new secret bindings together.
    functionId = foundId;
  }

  const writtenSecrets: FunctionSecretWriteResult[] = [];
  const succeededKeys: string[] = [];
  for (let i = 0; i < params.secrets.length; i++) {
    const pair = params.secrets[i];
    const pendingKeys = params.secrets.slice(i + 1).map((p) => p.key);
    const setResult = await api.setSecret({
      id: functionId,
      key: pair.key,
      value: pair.value,
    });
    if (setResult.error) {
      return {
        ...(createPayload ? { created: createPayload } : {}),
        failedKey: pair.key,
        functionId,
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
        ...(createPayload ? { created: createPayload } : {}),
        failedKey: pair.key,
        functionId,
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

  const updated = await api.updateFunction({
    files: params.files,
    id: functionId,
  });
  if (updated.error) {
    return {
      ...(createPayload ? { created: createPayload } : {}),
      functionId,
      kind: "error",
      payload: extractErrorPayload(updated.error),
      stage: "secret-redeploy",
      succeededKeys,
    };
  }
  const redeployed = updated.data?.data;
  if (!redeployed) {
    return {
      ...(createPayload ? { created: createPayload } : {}),
      functionId,
      kind: "error",
      payload: { code: "client_error", message: "Redeploy returned no data" },
      stage: "secret-redeploy",
      succeededKeys,
    };
  }
  return {
    kind: "ok",
    result: {
      action: foundId === null ? "created" : "redeployed",
      redeploy: redeployed,
      secrets: writtenSecrets,
    },
  };
}

// Render the structured diagnostics from a build_failed error payload to
// stderr. Managed build returns 422 build_failed with { details: { phase,
// errors[] } } when the source or dependencies are wrong.
export function renderBuildFailure(
  payload: unknown,
  write: (chunk: string) => void,
): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const error = (payload as { error?: unknown }).error ?? payload;
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code !== "build_failed") return false;
  const details = (error as { details?: unknown }).details;
  const phase =
    typeof details === "object" && details !== null
      ? (details as { phase?: unknown }).phase
      : undefined;
  write(
    `Build failed${typeof phase === "string" ? ` during ${phase}` : ""}.\n`,
  );
  const errors =
    typeof details === "object" && details !== null
      ? (details as { errors?: unknown }).errors
      : undefined;
  if (Array.isArray(errors)) {
    for (const e of errors) {
      if (typeof e !== "object" || e === null) continue;
      const item = e as {
        code?: unknown;
        message?: unknown;
        file?: unknown;
        line?: unknown;
        hint?: unknown;
      };
      const loc =
        typeof item.file === "string"
          ? ` (${item.file}${typeof item.line === "number" ? `:${item.line}` : ""})`
          : "";
      write(`  [${String(item.code)}] ${String(item.message)}${loc}\n`);
      if (typeof item.hint === "string") write(`     hint: ${item.hint}\n`);
    }
  }
  return true;
}
