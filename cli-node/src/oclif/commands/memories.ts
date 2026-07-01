import { Args, Command, Flags } from "@oclif/core";
import type {
  MemoryJsonValue,
  MemoryScope,
  SearchMemoriesData,
  SetMemoryInput,
} from "@primitivedotdev/api-core";
import {
  deleteMemory,
  getMemory,
  isMemoryJsonValue,
  searchMemories,
  setMemory,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  readTextFileFlag,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

type AuthHintBase = Omit<
  Parameters<typeof surfaceUnauthorizedHint>[0],
  "payload"
>;

type ScopeFlags = {
  function?: string;
  org?: boolean;
};

type ScopeQuery = NonNullable<SearchMemoriesData["query"]>;
type MemoryGetQuery = ScopeQuery & { key: string };
type MemoryDeleteQuery = MemoryGetQuery & { if_version?: string };

type ValueSourceResult =
  | { kind: "ok"; source: string; label: string }
  | { kind: "error"; message: string };

export type ParseMemoryJsonResult =
  | { kind: "ok"; value: MemoryJsonValue }
  | { kind: "error"; message: string };

class MemoryCliInputError extends Error {}

const API_KEY_FLAG = Flags.string({
  description:
    "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
  env: "PRIMITIVE_API_KEY",
});

const API_BASE_URL_FLAG = Flags.string({
  description: API_BASE_URL_FLAG_DESCRIPTION,
  env: "PRIMITIVE_API_BASE_URL",
  hidden: true,
});

const SCOPE_FLAGS = {
  function: Flags.string({
    description:
      "Function id (UUID) to scope this memory to. Function names are not accepted.",
    exclusive: ["org"],
  }),
  org: Flags.boolean({
    description:
      "Force org scope. Outside a function-authenticated request this is already the default.",
    exclusive: ["function"],
  }),
};

function reportMemoryError(error: unknown, context: AuthHintBase): void {
  const payload = extractErrorPayload(error);
  writeErrorWithHints(payload);
  surfaceUnauthorizedHint({ ...context, payload });
  process.exitCode = 1;
}

function printData(command: Command, responseData: unknown): void {
  const data = (responseData as { data?: unknown } | undefined)?.data ?? null;
  command.log(JSON.stringify(data, null, 2));
}

function handleMemoryInputError(error: unknown): boolean {
  if (!(error instanceof MemoryCliInputError)) return false;
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
  return true;
}

function nonEmptyFlag(
  value: string | undefined,
  name: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (value.trim().length === 0) {
    throw new MemoryCliInputError(`${name} must be a non-empty string.`);
  }
  return value;
}

export function parseMemoryJson(
  source: string,
  label = "value",
): ParseMemoryJsonResult {
  try {
    const value = JSON.parse(source) as unknown;
    if (!isMemoryJsonValue(value)) {
      return {
        kind: "error",
        message: `${label} must be valid JSON. Numbers must be finite, arrays must not be sparse, and values may not contain undefined, bigint, symbol, function, class instance, or cyclic entries.`,
      };
    }
    return { kind: "ok", value };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      kind: "error",
      message: `${label} must be valid JSON. Quote strings as JSON strings, for example '"hello"'. ${detail}`,
    };
  }
}

export function resolveMemoryValueSource(input: {
  value?: string;
  valueFile?: string;
  readFile?: (path: string) => string;
}): ValueSourceResult {
  if (input.value !== undefined && input.valueFile !== undefined) {
    return {
      kind: "error",
      message:
        "Provide the JSON value as either an argument or --value-file, not both.",
    };
  }
  if (input.value !== undefined) {
    return { kind: "ok", source: input.value, label: "value" };
  }
  if (input.valueFile !== undefined) {
    try {
      const source = input.readFile
        ? input.readFile(input.valueFile)
        : readTextFileFlag(input.valueFile, "--value-file");
      return {
        kind: "ok",
        source,
        label: `--value-file ${input.valueFile}`,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { kind: "error", message: detail };
    }
  }
  return {
    kind: "error",
    message: "Provide a JSON value argument or --value-file.",
  };
}

export function memoryScopeForBody(flags: ScopeFlags): MemoryScope | undefined {
  const functionId = nonEmptyFlag(flags.function, "--function");
  if (functionId !== undefined) return { type: "function", id: functionId };
  if (flags.org) return { type: "org" };
  return undefined;
}

export function memoryScopeForQuery(flags: ScopeFlags): ScopeQuery {
  const functionId = nonEmptyFlag(flags.function, "--function");
  if (functionId !== undefined) {
    return { scope_type: "function", scope_id: functionId };
  }
  if (flags.org) return { scope_type: "org" };
  return {};
}

export function buildSetMemoryInput(params: {
  key: string;
  value: MemoryJsonValue;
  flags: ScopeFlags & {
    "clear-ttl"?: boolean;
    "expires-at"?: string;
    "if-absent"?: boolean;
    "if-version"?: string;
    "ttl-seconds"?: number;
  };
}): SetMemoryInput {
  const scope = memoryScopeForBody(params.flags);
  const expiresAt = nonEmptyFlag(params.flags["expires-at"], "--expires-at");
  const ifVersion = nonEmptyFlag(params.flags["if-version"], "--if-version");
  return {
    key: params.key,
    value: params.value,
    ...(scope ? { scope } : {}),
    ...(params.flags["ttl-seconds"] !== undefined
      ? { ttl_seconds: params.flags["ttl-seconds"] }
      : {}),
    ...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
    ...(params.flags["clear-ttl"] ? { clear_ttl: true } : {}),
    ...(params.flags["if-absent"] ? { if_absent: true } : {}),
    ...(ifVersion !== undefined ? { if_version: ifVersion } : {}),
  };
}

export function buildGetMemoryQuery(params: {
  key: string;
  flags: ScopeFlags;
}): MemoryGetQuery {
  return { key: params.key, ...memoryScopeForQuery(params.flags) };
}

export function buildDeleteMemoryQuery(params: {
  key: string;
  flags: ScopeFlags & { "if-version"?: string };
}): MemoryDeleteQuery {
  const ifVersion = nonEmptyFlag(params.flags["if-version"], "--if-version");
  return {
    key: params.key,
    ...memoryScopeForQuery(params.flags),
    ...(ifVersion !== undefined ? { if_version: ifVersion } : {}),
  };
}

export function buildSearchMemoriesQuery(params: {
  prefix?: string;
  flags: ScopeFlags & {
    cursor?: string;
    limit: number;
    "metadata-only"?: boolean;
    "updated-after"?: string;
    "updated-before"?: string;
  };
}): ScopeQuery {
  const cursor = nonEmptyFlag(params.flags.cursor, "--cursor");
  const updatedAfter = nonEmptyFlag(
    params.flags["updated-after"],
    "--updated-after",
  );
  const updatedBefore = nonEmptyFlag(
    params.flags["updated-before"],
    "--updated-before",
  );
  return {
    ...(params.prefix !== undefined ? { prefix: params.prefix } : {}),
    limit: params.flags.limit,
    ...(cursor !== undefined ? { cursor } : {}),
    ...(params.flags["metadata-only"]
      ? { include_value: "false" as const }
      : {}),
    ...(updatedAfter !== undefined ? { updated_after: updatedAfter } : {}),
    ...(updatedBefore !== undefined ? { updated_before: updatedBefore } : {}),
    ...memoryScopeForQuery(params.flags),
  };
}

class MemoriesSetCommand extends Command {
  static description = `Set a Primitive memory to a JSON value.

  Values must be valid JSON. Objects, arrays, numbers, booleans, null, and quoted
  JSON strings are accepted. For example, pass '"hello"' for a string value.

  By default, CLI calls use org scope. Pass --function <function-id> to write a
  function-scoped memory by function id UUID. Function names are not accepted.`;

  static summary = "Set a memory";

  static examples = [
    `<%= config.bin %> memories set thread:latest '{"email_id":"em_123"}'`,
    `<%= config.bin %> memories set greeting '"hello"'`,
    `<%= config.bin %> memories set state '{"step":2}' --function <fn-id>`,
    `<%= config.bin %> memories set lock '{"owner":"agent"}' --if-absent`,
  ];

  static args = {
    key: Args.string({
      description: "Memory key, at most 512 UTF-8 bytes.",
      required: true,
    }),
    value: Args.string({
      description: "JSON value. Strings must be quoted as JSON strings.",
    }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    ...SCOPE_FLAGS,
    "value-file": Flags.string({
      description: "Read the JSON value from a UTF-8 file.",
    }),
    "ttl-seconds": Flags.integer({
      description:
        "Set or replace the TTL in seconds. Mutually exclusive with --expires-at and --clear-ttl.",
      min: 1,
      max: 31_536_000,
      exclusive: ["expires-at", "clear-ttl"],
    }),
    "expires-at": Flags.string({
      description:
        "Set or replace the absolute expiration timestamp. Mutually exclusive with --ttl-seconds and --clear-ttl.",
      exclusive: ["ttl-seconds", "clear-ttl"],
    }),
    "clear-ttl": Flags.boolean({
      description:
        "Clear any existing TTL. Mutually exclusive with --ttl-seconds and --expires-at.",
      exclusive: ["ttl-seconds", "expires-at"],
    }),
    "if-absent": Flags.boolean({
      description:
        "Create only when the key is absent. Mutually exclusive with --if-version.",
      exclusive: ["if-version"],
    }),
    "if-version": Flags.string({
      description:
        "Compare-and-set version. The write fails with memory_conflict if the current version differs.",
      exclusive: ["if-absent"],
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoriesSetCommand);

    const source = resolveMemoryValueSource({
      value: args.value,
      valueFile: flags["value-file"],
    });
    if (source.kind === "error") {
      process.stderr.write(`${source.message}\n`);
      process.exitCode = 1;
      return;
    }

    const parsed = parseMemoryJson(source.source, source.label);
    if (parsed.kind === "error") {
      process.stderr.write(`${parsed.message}\n`);
      process.exitCode = 1;
      return;
    }

    let body: SetMemoryInput;
    try {
      body = buildSetMemoryInput({
        key: args.key,
        value: parsed.value,
        flags,
      });
    } catch (error) {
      if (handleMemoryInputError(error)) return;
      throw error;
    }

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await setMemory({
        client: apiClient.client,
        body,
        responseStyle: "fields",
      });

      if (result.error) {
        reportMemoryError(result.error, {
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
        });
        return;
      }

      printData(this, result.data);
    });
  }
}

class MemoriesGetCommand extends Command {
  static description = `Get a Primitive memory by key.

  By default, CLI calls use org scope. Pass --function <function-id> to read a
  function-scoped memory by function id UUID. Function names are not accepted.`;

  static summary = "Get a memory";

  static examples = [
    "<%= config.bin %> memories get thread:latest",
    "<%= config.bin %> memories get state --function <fn-id>",
  ];

  static args = {
    key: Args.string({
      description: "Memory key.",
      required: true,
    }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    ...SCOPE_FLAGS,
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoriesGetCommand);
    let query: MemoryGetQuery;
    try {
      query = buildGetMemoryQuery({ key: args.key, flags });
    } catch (error) {
      if (handleMemoryInputError(error)) return;
      throw error;
    }

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await getMemory({
        client: apiClient.client,
        query,
        responseStyle: "fields",
      });

      if (result.error) {
        reportMemoryError(result.error, {
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
        });
        return;
      }

      printData(this, result.data);
    });
  }
}

class MemoriesDeleteCommand extends Command {
  static description = `Delete a Primitive memory by key.

  Deletes are idempotent when --if-version is omitted. With --if-version, a
  stale version fails with memory_conflict. Pass --function <function-id> to
  delete from a function scope by function id UUID.`;

  static summary = "Delete a memory";

  static examples = [
    "<%= config.bin %> memories delete thread:latest",
    "<%= config.bin %> memories delete state --function <fn-id> --if-version 3",
  ];

  static args = {
    key: Args.string({
      description: "Memory key.",
      required: true,
    }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    ...SCOPE_FLAGS,
    "if-version": Flags.string({
      description:
        "Compare-and-delete version. The delete fails with memory_conflict if the current version differs.",
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoriesDeleteCommand);
    let query: MemoryDeleteQuery;
    try {
      query = buildDeleteMemoryQuery({ key: args.key, flags });
    } catch (error) {
      if (handleMemoryInputError(error)) return;
      throw error;
    }

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await deleteMemory({
        client: apiClient.client,
        query,
        responseStyle: "fields",
      });

      if (result.error) {
        reportMemoryError(result.error, {
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
        });
        return;
      }

      printData(this, result.data);
    });
  }
}

class MemoriesSearchCommand extends Command {
  static description = `Search Primitive memories by key prefix.

  Results are ordered by key ascending. Pass --metadata-only to omit values.
  Pass --function <function-id> to search a function scope by function id UUID.`;

  static summary = "Search memories";

  static examples = [
    "<%= config.bin %> memories search thread:",
    "<%= config.bin %> memories search --metadata-only --limit 100",
    "<%= config.bin %> memories search state: --function <fn-id>",
  ];

  static args = {
    prefix: Args.string({
      description: "Key prefix. Omit to list all active memories in scope.",
    }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    ...SCOPE_FLAGS,
    limit: Flags.integer({
      description: "Maximum results to return (1-100, default 50).",
      default: 50,
      min: 1,
      max: 100,
    }),
    cursor: Flags.string({
      description: "Key cursor from a previous response's meta.cursor.",
    }),
    "metadata-only": Flags.boolean({
      description: "Omit memory values and return metadata only.",
    }),
    "updated-after": Flags.string({
      description:
        "Only include memories updated at or after this ISO timestamp.",
    }),
    "updated-before": Flags.string({
      description:
        "Only include memories updated at or before this ISO timestamp.",
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoriesSearchCommand);
    let query: ScopeQuery;
    try {
      query = buildSearchMemoriesQuery({ prefix: args.prefix, flags });
    } catch (error) {
      if (handleMemoryInputError(error)) return;
      throw error;
    }

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await searchMemories({
        client: apiClient.client,
        query,
        responseStyle: "fields",
      });

      if (result.error) {
        reportMemoryError(result.error, {
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
        });
        return;
      }

      printData(this, result.data);
    });
  }
}

export {
  MemoriesDeleteCommand,
  MemoriesGetCommand,
  MemoriesSearchCommand,
  MemoriesSetCommand,
};
