// Additions a CLI module makes to one generated operation command, keyed by
// the operation's sdkName in OPERATION_EXTENSIONS (api-command.ts). The
// generated command stays in charge of the request and of stdout; an
// extension only adds flags that set request body fields, and reads the
// answer to add a report on stderr and an exit code.

/** A request body field set by an extension's flags. */
export type ExtensionBodyField = {
  /** The flag or flags that set it, as the caller typed them (`--expect-file`). */
  flag: string;
  property: string;
  value: unknown;
};

/** What an extension makes of a successful answer. */
export type OperationReport = {
  /** Lines for stderr, after the JSON on stdout, and only without --json. */
  lines: string[];
  /** The exit code; undefined or 0 keeps the command's usual 0. */
  exitCode?: number;
  /**
   * With a non-zero exitCode, the `error` a --json document carries, so the
   * document says why the command exited non-zero.
   */
  error?: { code: string; message: string };
};

export type OperationExtension = {
  /** Flags added to the generated command's own. */
  flags: Record<string, unknown>;
  /**
   * The body fields the added flags set. They are merged over --raw-body or
   * --body-file like the generated per-field flags, and win on conflict.
   * Throws a CLIError for a value it refuses.
   */
  bodyFields?: (flags: Record<string, unknown>) => ExtensionBodyField[];
  /**
   * The body properties bodyFields can set, left out of the --help list of
   * fields that only --raw-body can carry.
   */
  bodyProperties?: readonly string[];
  /**
   * The exit code when report throws, read from the raw answer, so a report
   * that cannot be built never turns a failing answer into a pass.
   */
  fallbackExitCode?: (data: unknown) => number | undefined;
  /** Read the answer's data, given the request body and path that were sent. */
  report?: (
    data: unknown,
    request: { body: unknown; path: Record<string, unknown> },
  ) => OperationReport;
};
