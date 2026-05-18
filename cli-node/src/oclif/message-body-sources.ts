import { readFileSync } from "node:fs";

export type MessageBodySourceFlags = {
  body?: string;
  html?: string;
  bodyFile?: string;
  htmlFile?: string;
  bodyStdin?: boolean;
  htmlStdin?: boolean;
  readFile?: (path: string) => string;
  readStdin?: () => string;
};

export type ResolvedMessageBodies =
  | { kind: "ok"; body?: string; html?: string }
  | { kind: "error"; message: string };

type TextSourceResult =
  | { kind: "ok"; content: string }
  | { kind: "error"; message: string };

function defaultReadFile(path: string): string {
  return readFileSync(path, "utf8");
}

function defaultReadStdin(): string {
  if (process.stdin.isTTY) {
    throw new Error(
      "stdin is a TTY; pipe a value into this command or pass a file/string source instead.",
    );
  }
  return readFileSync(0, "utf8");
}

function selectedSources(
  sources: Array<[label: string, selected: boolean]>,
): string[] {
  return sources.filter(([, selected]) => selected).map(([label]) => label);
}

function readTextFile(
  path: string,
  label: string,
  readFile: (path: string) => string,
): TextSourceResult {
  try {
    return { content: readFile(path), kind: "ok" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      kind: "error",
      message: `Could not read ${label} ${path}: ${detail}`,
    };
  }
}

function readTextStdin(
  label: string,
  readStdin: () => string,
): TextSourceResult {
  try {
    return { content: readStdin(), kind: "ok" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      kind: "error",
      message: `Could not read ${label}: ${detail}`,
    };
  }
}

export function resolveMessageBodies(
  input: MessageBodySourceFlags,
): ResolvedMessageBodies {
  const bodySources = selectedSources([
    ["--body", input.body !== undefined],
    ["--body-file", input.bodyFile !== undefined],
    ["--body-stdin", input.bodyStdin === true],
  ]);
  if (bodySources.length > 1) {
    return {
      kind: "error",
      message: `Pass only one plain-text body source (got ${bodySources.join(", ")}).`,
    };
  }

  const htmlSources = selectedSources([
    ["--html", input.html !== undefined],
    ["--html-file", input.htmlFile !== undefined],
    ["--html-stdin", input.htmlStdin === true],
  ]);
  if (htmlSources.length > 1) {
    return {
      kind: "error",
      message: `Pass only one HTML body source (got ${htmlSources.join(", ")}).`,
    };
  }

  const stdinSources = selectedSources([
    ["--body-stdin", input.bodyStdin === true],
    ["--html-stdin", input.htmlStdin === true],
  ]);
  if (stdinSources.length > 1) {
    return {
      kind: "error",
      message: `Stdin can only be consumed once (got ${stdinSources.join(", ")}).`,
    };
  }

  if (bodySources.length === 0 && htmlSources.length === 0) {
    return {
      kind: "error",
      message:
        "Either a plain-text body source or an HTML body source is required.",
    };
  }

  const readFile = input.readFile ?? defaultReadFile;
  const readStdin = input.readStdin ?? defaultReadStdin;
  let body = input.body;
  let html = input.html;

  if (input.bodyFile !== undefined) {
    const result = readTextFile(input.bodyFile, "--body-file", readFile);
    if (result.kind === "error") return result;
    body = result.content;
  }
  if (input.bodyStdin === true) {
    const result = readTextStdin("--body-stdin", readStdin);
    if (result.kind === "error") return result;
    body = result.content;
  }
  if (input.htmlFile !== undefined) {
    const result = readTextFile(input.htmlFile, "--html-file", readFile);
    if (result.kind === "error") return result;
    html = result.content;
  }
  if (input.htmlStdin === true) {
    const result = readTextStdin("--html-stdin", readStdin);
    if (result.kind === "error") return result;
    html = result.content;
  }

  if (!body && !html) {
    return {
      kind: "error",
      message:
        "Either a non-empty plain-text body or a non-empty HTML body is required.",
    };
  }

  return {
    ...(body !== undefined ? { body } : {}),
    ...(html !== undefined ? { html } : {}),
    kind: "ok",
  };
}
