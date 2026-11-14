// Additions a CLI module makes to one generated operation command, keyed by
// the operation's sdkName in OPERATION_EXTENSIONS (api-command.ts). The
// generated command stays in charge of the request and of stdout; an
// extension only adds flags that set request body fields, asks for
// confirmation before a request that cannot be undone, and reads the answer
// to add a report on stderr and an exit code.

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
  /**
   * Keys the CLI worked out from the answer, added beside it in a --json
   * document (and never over a key the answer has), such as the comparison
   * test-email-rule makes with --same-emails-as.
   */
  json?: Record<string, unknown>;
};

/**
 * A yes/no question asked before the request is sent. With --yes nothing is
 * asked. Without a terminal on stdin and stderr, or under --json, the command
 * sends nothing and exits 2, naming --yes. An answer other than y or yes sends
 * nothing and exits 1. The extension's flags must include `yes`.
 */
export type OperationConfirmation = {
  /** The question, given the parsed flags (the path parameter among them). */
  question: (flags: Record<string, unknown>) => string;
  /** The refusal without a terminal to ask in. */
  noTerminal: string;
  /** Printed on stderr when the answer is not yes. */
  cancelled: string;
};

export type OperationExtension = {
  /** Flags added to the generated command's own. */
  flags: Record<string, unknown>;
  /** A confirmation asked before the request is sent. */
  confirm?: OperationConfirmation;
  /**
   * The body fields the added flags set. They are merged over --raw-body or
   * --body-file like the generated per-field flags, and win on conflict.
   * `base` is the body --raw-body or --body-file gave, before any flag is
   * merged over it (undefined when neither was given). Throws a CLIError for
   * a value it refuses.
   */
  bodyFields?: (
    flags: Record<string, unknown>,
    base: unknown,
  ) => ExtensionBodyField[];
  /**
   * The body properties bodyFields can set, left out of the --help list of
   * fields that only --raw-body can carry.
   */
  bodyProperties?: readonly string[];
  /**
   * The exit code when report throws, read from the raw answer, so a report
   * that cannot be built never turns a failing answer into a pass.
   */
  fallbackExitCode?: (
    data: unknown,
    request: { body: unknown; flags: Record<string, unknown> },
  ) => number | undefined;
  /**
   * The exit code for an error answer, read from its payload (the error
   * object); undefined keeps the usual 1.
   */
  errorExitCode?: (payload: unknown) => number | undefined;
  /**
   * Read the answer's data, given the request body and path that were sent
   * and the command's parsed flags.
   */
  report?: (
    data: unknown,
    request: {
      body: unknown;
      path: Record<string, unknown>;
      flags: Record<string, unknown>;
    },
  ) => OperationReport;
};
