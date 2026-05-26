import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type {
  CreateFunctionResult,
  FunctionDetail,
  FunctionListItem,
} from "@primitivedotdev/api-core";
import { extractErrorPayload } from "./api-command.js";

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
