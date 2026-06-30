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

type ValueSourceResult =
  | { kind: "ok"; source: string; label: string }
  | { kind: "error"; message: string };

export type ParseMemoryJsonResult =
  | { kind: "ok"; value: MemoryJsonValue }
  | { kind: "error"; message: string };

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

export function parseMemoryJson(
  source: string,
  label = "value",
): ParseMemoryJsonResult {
  try {
    return { kind: "ok", value: JSON.parse(source) as MemoryJsonValue };
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
  if (flags.function) return { type: "function", id: flags.function };
  if (flags.org) return { type: "org" };
  return undefined;
}

export function memoryScopeForQuery(flags: ScopeFlags): ScopeQuery {
  if (flags.function) {
    return { scope_type: "function", scope_id: flags.function };
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
  return {
    key: params.key,
    value: params.value,
    ...(scope ? { scope } : {}),
    ...(params.flags["ttl-seconds"] !== undefined
      ? { ttl_seconds: params.flags["ttl-seconds"] }
      : {}),
    ...(params.flags["expires-at"]
      ? { expires_at: params.flags["expires-at"] }
      : {}),
    ...(params.flags["clear-ttl"] ? { clear_ttl: true } : {}),
    ...(params.flags["if-absent"] ? { if_absent: true } : {}),
    ...(params.flags["if-version"]
      ? { if_version: params.flags["if-version"] }
      : {}),
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

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await setMemory({
        client: apiClient.client,
        body: buildSetMemoryInput({
          key: args.key,
          value: parsed.value,
          flags,
        }),
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
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await getMemory({
        client: apiClient.client,
        query: { key: args.key, ...memoryScopeForQuery(flags) },
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
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await deleteMemory({
        client: apiClient.client,
        query: {
          key: args.key,
          ...memoryScopeForQuery(flags),
          ...(flags["if-version"] ? { if_version: flags["if-version"] } : {}),
        },
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
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await searchMemories({
        client: apiClient.client,
        query: {
          ...(args.prefix !== undefined ? { prefix: args.prefix } : {}),
          limit: flags.limit,
          ...(flags.cursor ? { cursor: flags.cursor } : {}),
          ...(flags["metadata-only"]
            ? { include_value: "false" as const }
            : {}),
          ...(flags["updated-after"]
            ? { updated_after: flags["updated-after"] }
            : {}),
          ...(flags["updated-before"]
            ? { updated_before: flags["updated-before"] }
            : {}),
          ...memoryScopeForQuery(flags),
        },
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
