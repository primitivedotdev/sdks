import { Command, Errors } from "@oclif/core";
import { withBooleanFlagValues } from "./boolean-flag-values.js";
import { canonicalCliText } from "./cli-command-names.js";
import { ignoreArgumentStdin } from "./command-stdin.js";
import { withFlagSuggestion } from "./flag-suggestions.js";
import type { HelpInputs } from "./help-inputs.js";
import { captureOutput, JSON_OUTPUT_FLAG } from "./json-output.js";
import { displayedRoleKey } from "./user-grant.js";

type FlagDefinition = {
  type?: string;
  required?: boolean;
  default?: unknown;
  max?: number;
  min?: number;
  allowNo?: boolean;
  options?: readonly string[];
};

function flagsOf(command: typeof Command): Record<string, FlagDefinition> {
  return {
    ...(command.flags as Record<string, FlagDefinition>),
    ...(command.enableJsonFlag ? { json: JSON_OUTPUT_FLAG } : {}),
  };
}

function booleanFlag(flag: FlagDefinition | undefined): boolean {
  return (
    flag?.type === "boolean" ||
    (flag?.options?.length === 2 &&
      flag.options.includes("true") &&
      flag.options.includes("false"))
  );
}

function delegateArgv(
  command: typeof Command,
  values: Record<string, unknown>,
  names: ReadonlySet<string>,
  args: Record<string, unknown>,
): string[] {
  const definitions = flagsOf(command);
  const argv: string[] = [];
  for (const name of names) {
    // JSON is rendered by the canonical command even when a task originally
    // printed JSON without accepting an explicit --json option.
    if (name === "json" && definitions[name] === undefined) continue;
    const value = values[name];
    if (value === undefined) continue;
    const definition = definitions[name];
    for (const item of Array.isArray(value) ? value : [value]) {
      if (definition?.type === "boolean") {
        argv.push(item === false ? `--no-${name}` : `--${name}`);
      } else argv.push(`--${name}=${String(item)}`);
    }
  }
  const positional = Object.keys(command.args ?? {}).flatMap((name) =>
    args[name] === undefined ? [] : [String(args[name])],
  );
  if (positional.length) argv.push("--", ...positional);
  return argv;
}

/** One path with task inputs and structured request inputs, never two aliases. */
export function combineCommandPair(
  task: typeof Command,
  request: typeof Command,
  options: { storedRedeploy?: boolean; listPage?: "keys" | "members" } = {},
): typeof Command {
  ignoreArgumentStdin(task);
  ignoreArgumentStdin(request);
  const taskFlags = flagsOf(task);
  const requestFlags = flagsOf(request);
  const flags: Record<string, FlagDefinition> = {};
  for (const [name, flag] of Object.entries({
    ...requestFlags,
    ...taskFlags,
  })) {
    const a = taskFlags[name];
    const b = requestFlags[name];
    flags[name] = {
      ...flag,
      required: false,
      // Defaults shown for a single input form are descriptive only.
      // The neutral parser below never applies them before delegation.
      default: a && b ? undefined : flag.default,
      ...(booleanFlag(a) && booleanFlag(b)
        ? {
            type: "boolean",
            allowNo: a?.allowNo || b?.allowNo || a?.type !== b?.type,
          }
        : {}),
      ...(typeof a?.max === "number" && typeof b?.max === "number"
        ? { max: Math.max(a.max, b.max) }
        : {}),
    };
    if (flags[name]?.type === "boolean") delete flags[name].options;
  }
  const taskArgs = task.args ?? {};
  const requestArgs = request.args ?? {};
  const args = Object.fromEntries(
    Object.entries(Object.keys(taskArgs).length ? taskArgs : requestArgs).map(
      ([name, argument]) => [
        name,
        { ...argument, required: false, ignoreStdin: true },
      ],
    ),
  );
  // Select the input form using transport values only. Each delegate then
  // enforces its own enums, ranges and flag relationships. Applying one
  // form's constraints here would reject inputs supported by the other.
  const parseFlags = Object.fromEntries(
    Object.entries(flags).map(([name, flag]) => {
      const neutral: Record<string, unknown> = {
        ...flag,
        parse: async (value: unknown) => value,
      };
      for (const key of [
        "required",
        "default",
        "exclusive",
        "exactlyOne",
        "atLeastOne",
        "dependsOn",
        "relationships",
        "min",
        "max",
        "options",
      ])
        delete neutral[key];
      return [name, neutral];
    }),
  );
  const requestHelp = (request as typeof Command & { helpInputs?: HelpInputs })
    .helpInputs;
  const requiredTaskFlags = Object.keys(taskFlags).filter(
    (name) => taskFlags[name]?.required,
  );
  const requiredTaskArgs = Object.keys(taskArgs).filter(
    (name) => taskArgs[name]?.required,
  );
  const taskInput = [
    ...requiredTaskArgs.map((name) => `<${name}>`),
    ...requiredTaskFlags.map((name) => `--${name}`),
  ].join(" ");

  class CombinedCommand extends Command {
    static pairedCommand = true;
    static summary = options.storedRedeploy
      ? request.summary
      : (task.summary ?? request.summary);
    static description = canonicalCliText(
      `${options.storedRedeploy ? "Redeploy the function's stored source, or pass --file to upload a new bundle with the existing secret and deployment-wait options.\n\n" : ""}${task.description ?? ""}\n\n${taskInput ? `Readable input form: ${taskInput}. Alternatively, use the request fields below or JSON.\n\n` : ""}Inputs exclusive to the readable form cannot be mixed with request-only fields. With --json, the result is in data and existing pagination metadata is preserved.\n\n${request.description ?? ""}`,
    );
    static helpInputs: HelpInputs = {
      requiredFlags: [
        ...new Set([
          ...requiredTaskFlags,
          ...(requestHelp?.requiredFlags ?? []),
        ]),
      ],
      requiredJsonFields: requestHelp?.requiredJsonFields ?? [],
    };
    static examples = task.examples?.map((example) =>
      typeof example === "string"
        ? canonicalCliText(example)
        : { ...example, command: canonicalCliText(example.command) },
    );
    static flags = flags as never;
    static args = args as never;

    async run(): Promise<void> {
      const argv = withBooleanFlagValues(this.argv, flags);
      const parsed = await this.parse(
        { flags: parseFlags, args, strict: true } as never,
        argv,
      ).catch((error: unknown) => {
        throw withFlagSuggestion(error, Object.keys(flags));
      });
      const values = parsed.flags as Record<string, unknown>;
      const givenFlags = new Set(
        parsed.raw.flatMap((token) =>
          token.type === "flag" ? [token.flag] : [],
        ),
      );
      const suppliedArgs = Object.entries(parsed.args).filter(
        ([, value]) => value !== undefined,
      );
      const requestOnly = Object.keys(requestFlags).filter(
        (name) =>
          name !== "json" && !(name in taskFlags) && givenFlags.has(name),
      );
      const taskOnly = Object.keys(taskFlags).filter(
        (name) => !(name in requestFlags) && givenFlags.has(name),
      );
      const needsRequest =
        requestOnly.length > 0 ||
        suppliedArgs.some(([name]) => !(name in taskArgs)) ||
        Object.entries(values).some(([name, value]) => {
          if (!(name in requestFlags)) return false;
          const limit = taskFlags[name]?.max;
          const numeric =
            typeof value === "number"
              ? value
              : typeof value === "string" && value.trim() !== ""
                ? Number(value)
                : Number.NaN;
          return (
            value === "" ||
            (value === false &&
              taskFlags[name]?.type === "boolean" &&
              !taskFlags[name]?.allowNo) ||
            (Number.isFinite(numeric) && limit !== undefined && numeric > limit)
          );
        }) ||
        (options.storedRedeploy === true && values.file === undefined);
      if (needsRequest && taskOnly.length > 0) {
        throw new Errors.CLIError(
          `Cannot combine ${taskOnly.map((name) => `--${name}`).join(", ")} with structured request input. Use the task flags together, or supply the request with API fields and JSON.`,
          { exit: 2 },
        );
      }
      if (
        needsRequest &&
        suppliedArgs.some(([name]) => !(name in requestArgs))
      ) {
        throw new Errors.CLIError(
          "Positional task values cannot be combined with structured request flags. Put those values in the request's flags or JSON body.",
          { exit: 2 },
        );
      }
      const selected = (needsRequest ? request : task) as Command.Class;
      const forwarded = delegateArgv(selected, values, givenFlags, parsed.args);
      if (values.json !== true) {
        await selected.run(forwarded, this.config);
        return;
      }
      const output = captureOutput();
      let thrown: unknown;
      try {
        await selected.run(forwarded, this.config);
      } catch (error) {
        thrown = error;
      } finally {
        output.restore();
      }
      const text = output.stdout.join("");
      if (text.trim() && thrown === undefined && !process.exitCode) {
        const value: unknown = JSON.parse(text);
        const document =
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          ("data" in value || "error" in value)
            ? (value as Record<string, unknown>)
            : { data: value };
        if (!("error" in document) && document.success === undefined)
          document.success = true;
        if (options.listPage && !("error" in document)) {
          const page = document.data;
          if (
            page !== null &&
            typeof page === "object" &&
            !Array.isArray(page)
          ) {
            const fields = page as Record<string, unknown>;
            if (Array.isArray(fields.items)) {
              const cursor =
                options.listPage === "keys"
                  ? fields.next_cursor
                  : fields.cursor;
              document.data = fields.items;
              document.meta = {
                ...(document.meta as Record<string, unknown> | undefined),
                cursor: cursor ?? null,
                ...(options.listPage === "keys"
                  ? { has_more: Boolean(cursor) }
                  : { can_invite: fields.can_invite }),
              };
            }
          }
        }
        if (options.listPage === "members" && Array.isArray(document.data)) {
          document.data = document.data.map((person: unknown) => {
            if (person === null || typeof person !== "object") return person;
            const row = person as Record<string, unknown>;
            return typeof row.role === "string"
              ? { ...row, role: displayedRoleKey(row.role) }
              : row;
          });
        }
        if (Array.isArray(document.data) && document.meta === undefined)
          document.meta = {};
        this.log(JSON.stringify(document));
      } else if (text) process.stdout.write(text);
      for (const chunk of output.stderr) process.stderr.write(chunk);
      if (thrown !== undefined) throw thrown;
    }
  }
  return CombinedCommand;
}
