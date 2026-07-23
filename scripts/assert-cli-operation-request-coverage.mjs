#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const DEFAULT_MANIFEST = path.join(
  REPO_ROOT,
  "cli-rust/src/operation-manifest.json",
);
const DEFAULT_CASES = path.join(
  REPO_ROOT,
  "test-fixtures/cli-parity/cases.json",
);
const DEFAULT_ALIAS_SOURCE = path.join(REPO_ROOT, "cli-rust/src/manifest.rs");

function usage() {
  return `Usage:
  node scripts/assert-cli-operation-request-coverage.mjs [options]

Options:
  --manifest <path>     Operation manifest. Defaults to cli-rust/src/operation-manifest.json
  --cases <path>        Fixture file. Defaults to test-fixtures/cli-parity/cases.json
  --aliases-source <path>
                        Rust manifest source. Defaults to cli-rust/src/manifest.rs
  --list-missing        Print uncovered operation ids and method/path.
  --min-covered <n>     Exit nonzero when fewer than n operations are covered.
  --min-aliases <n>     Exit nonzero when fewer than n generated aliases are exercised.
  --require-all         Exit nonzero when any manifest operation is uncovered.
  --require-generated-command-fixtures
                        Exit nonzero when any generated operation lacks an exact
                        canonical or alias command fixture.
  --require-canonical-generated-command-fixtures
                        Exit nonzero when any generated operation lacks an exact
                        canonical command fixture.
  --require-generated-alias-fixtures
                        Exit nonzero when any generated alias lacks an exact
                        runtime request fixture.
`;
}

function parseArgs(argv) {
  const options = {
    aliasSourcePath: DEFAULT_ALIAS_SOURCE,
    casesPath: DEFAULT_CASES,
    listMissing: false,
    minAliases: null,
    manifestPath: DEFAULT_MANIFEST,
    minCovered: null,
    requireCanonicalGeneratedCommandFixtures: false,
    requireAll: false,
    requireGeneratedAliasFixtures: false,
    requireGeneratedCommandFixtures: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--list-missing") {
      options.listMissing = true;
      continue;
    }
    if (arg === "--require-all") {
      options.requireAll = true;
      continue;
    }
    if (arg === "--require-generated-command-fixtures") {
      options.requireGeneratedCommandFixtures = true;
      continue;
    }
    if (arg === "--require-canonical-generated-command-fixtures") {
      options.requireCanonicalGeneratedCommandFixtures = true;
      continue;
    }
    if (arg === "--require-generated-alias-fixtures") {
      options.requireGeneratedAliasFixtures = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) throw new Error(`Missing value for ${arg}`);
    if (arg === "--manifest" || arg === "--manifest-path") {
      options.manifestPath = path.resolve(next);
    } else if (arg === "--aliases-source") {
      options.aliasSourcePath = path.resolve(next);
    } else if (arg === "--cases" || arg === "--cases-path") {
      options.casesPath = path.resolve(next);
    } else if (arg === "--min-covered") {
      const value = Number(next);
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(
          `--min-covered must be a nonnegative integer, got ${JSON.stringify(next)}`,
        );
      }
      options.minCovered = value;
    } else if (arg === "--min-aliases") {
      const value = Number(next);
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(
          `--min-aliases must be a nonnegative integer, got ${JSON.stringify(next)}`,
        );
      }
      options.minAliases = value;
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
    index += 1;
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

function manifestFixturePath(operationPath) {
  const rootedPath = operationPath.startsWith("/")
    ? operationPath
    : `/${operationPath}`;
  if (rootedPath === "/v1" || rootedPath.startsWith("/v1/")) return rootedPath;
  return `/v1${rootedPath}`;
}

function escapeRegex(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function pathTemplateRegex(template) {
  const parts = template.split("/");
  const source = parts
    .map((part) => (/^\{[^/{}]+\}$/.test(part) ? "[^/]+" : escapeRegex(part)))
    .join("/");
  return new RegExp(`^${source}$`);
}

function exactRequestExpectations(caseItem) {
  const expectations = [];
  const appendRequests = (source) => {
    if (!Array.isArray(source?.requests)) return;
    for (const request of source.requests) {
      if (
        typeof request?.method === "string" &&
        typeof request.path === "string"
      ) {
        expectations.push({
          method: request.method.toUpperCase(),
          path: request.path,
        });
      }
    }
  };

  appendRequests(caseItem.expect);
  for (const runnerExpect of Object.values(caseItem.expectByRunner ?? {})) {
    appendRequests(runnerExpect);
  }
  return expectations;
}

function fixtureRequestExpectations(casesDocument) {
  if (!Array.isArray(casesDocument.cases)) {
    throw new Error("Fixture file must contain a cases array.");
  }
  return casesDocument.cases.flatMap((caseItem) =>
    exactRequestExpectations(caseItem),
  );
}

function fixtureArgLists(casesDocument) {
  if (!Array.isArray(casesDocument.cases)) {
    throw new Error("Fixture file must contain a cases array.");
  }
  return casesDocument.cases.map((caseItem, index) => {
    if (!Array.isArray(caseItem?.args)) {
      throw new Error(`Fixture case ${index} must include an args array.`);
    }
    return caseItem.args;
  });
}

function normalizeOperations(manifest) {
  if (!Array.isArray(manifest)) {
    throw new Error("Operation manifest must be an array.");
  }
  return manifest.map((operation, index) => {
    if (
      typeof operation?.operationId !== "string" ||
      typeof operation.method !== "string" ||
      typeof operation.path !== "string"
    ) {
      throw new Error(
        `Operation manifest entry ${index} must include operationId, method, and path.`,
      );
    }
    const fixturePath = manifestFixturePath(operation.path);
    return {
      command: operation.command,
      fixturePath,
      method: operation.method.toUpperCase(),
      operationId: operation.operationId,
      pathRegex: pathTemplateRegex(fixturePath),
      tagCommand: operation.tagCommand,
    };
  });
}

function coveredOperationIds(operations, requests) {
  const covered = new Set();
  for (const operation of operations) {
    const hasExpectation = requests.some(
      (request) =>
        request.method === operation.method &&
        operation.pathRegex.test(request.path),
    );
    if (hasExpectation) covered.add(operation.operationId);
  }
  return covered;
}

function generatedCliAliases(manifestSource) {
  const block = manifestSource.match(
    /pub fn generated_cli_aliases\(\) -> &'static \[\(&'static str, &'static str\)\] \{\s*&\[(?<body>[\s\S]*?)\]\s*\}/,
  );
  if (!block?.groups?.body) {
    throw new Error("Could not find generated_cli_aliases() in alias source.");
  }

  const aliases = [];
  for (const match of block.groups.body.matchAll(
    /\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,?\s*\)/g,
  )) {
    aliases.push({
      alias: match[1],
      target: match[2],
    });
  }
  if (aliases.length === 0) {
    throw new Error("generated_cli_aliases() did not contain any aliases.");
  }
  return aliases;
}

function fixtureUsesCommandAlias(args, alias) {
  if (!Array.isArray(args) || args.length === 0) return false;
  if (args[0] === alias) return true;
  const aliasParts = alias.split(":");
  return args.slice(0, aliasParts.length).join(":") === alias;
}

function coveredGeneratedAliases(aliases, argLists) {
  const covered = new Set();
  for (const { alias } of aliases) {
    if (argLists.some((args) => fixtureUsesCommandAlias(args, alias))) {
      covered.add(alias);
    }
  }
  return covered;
}

function operationCommandId(operation) {
  return `${operation.tagCommand}:${operation.command}`;
}

function commandForms(commandId) {
  const forms = [commandId];
  if (commandId.includes(":")) forms.push(commandId.split(":").join(" "));
  return forms;
}

function fixtureUsesCommandForm(args, commandId) {
  if (!Array.isArray(args) || args.length === 0) return false;
  return commandForms(commandId).some((form) => {
    const parts = form.split(" ");
    return args.slice(0, parts.length).join(" ") === form;
  });
}

function operationsMissingCommandFixtures(operations, aliases, argLists) {
  const aliasesByTarget = new Map();
  for (const { alias, target } of aliases) {
    const existing = aliasesByTarget.get(target) ?? [];
    existing.push(alias);
    aliasesByTarget.set(target, existing);
  }

  return operations.filter((operation) => {
    const commandId = operationCommandId(operation);
    const commandIds = [commandId, ...(aliasesByTarget.get(commandId) ?? [])];
    return !argLists.some((args) =>
      commandIds.some((candidate) => fixtureUsesCommandForm(args, candidate)),
    );
  });
}

function operationsMissingCanonicalCommandFixtures(operations, argLists) {
  return operations.filter((operation) => {
    const commandId = operationCommandId(operation);
    return !argLists.some((args) => fixtureUsesCommandForm(args, commandId));
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const casesDocument = readJson(options.casesPath);
  const operations = normalizeOperations(readJson(options.manifestPath));
  const requests = fixtureRequestExpectations(casesDocument);
  const covered = coveredOperationIds(operations, requests);
  const missing = operations.filter(
    (operation) => !covered.has(operation.operationId),
  );
  const aliases = generatedCliAliases(readText(options.aliasSourcePath));
  const argLists = fixtureArgLists(casesDocument);
  const coveredAliases = coveredGeneratedAliases(aliases, argLists);
  const missingAliases = aliases.filter(
    ({ alias }) => !coveredAliases.has(alias),
  );
  const missingCommandFixtures = operationsMissingCommandFixtures(
    operations,
    aliases,
    argLists,
  );
  const missingCanonicalCommandFixtures =
    operationsMissingCanonicalCommandFixtures(operations, argLists);

  console.log(
    `CLI operation request coverage: ${covered.size}/${operations.length} covered, ${missing.length} uncovered.`,
  );
  console.log(
    `CLI generated alias fixture coverage: ${coveredAliases.size}/${aliases.length} exercised, ${missingAliases.length} unexercised.`,
  );
  console.log(
    `CLI generated command fixture coverage: ${operations.length - missingCommandFixtures.length}/${operations.length} covered, ${missingCommandFixtures.length} uncovered.`,
  );
  console.log(
    `CLI canonical generated command fixture coverage: ${operations.length - missingCanonicalCommandFixtures.length}/${operations.length} covered, ${missingCanonicalCommandFixtures.length} uncovered.`,
  );

  if (options.listMissing && missing.length > 0) {
    console.log("Missing operations:");
    for (const operation of missing) {
      console.log(
        `  ${operation.operationId} ${operation.method} ${operation.fixturePath}`,
      );
    }
  }
  if (options.listMissing && missingAliases.length > 0) {
    console.log("Missing generated aliases:");
    for (const { alias, target } of missingAliases) {
      console.log(`  ${alias} -> ${target}`);
    }
  }
  if (options.listMissing && missingCommandFixtures.length > 0) {
    console.log("Missing generated command fixtures:");
    for (const operation of missingCommandFixtures) {
      console.log(
        `  ${operation.operationId} ${operationCommandId(operation)}`,
      );
    }
  }
  if (options.listMissing && missingCanonicalCommandFixtures.length > 0) {
    console.log("Missing canonical generated command fixtures:");
    for (const operation of missingCanonicalCommandFixtures) {
      console.log(
        `  ${operation.operationId} ${operationCommandId(operation)}`,
      );
    }
  }

  if (options.minCovered !== null && covered.size < options.minCovered) {
    console.error(
      `Minimum covered operations not met: expected at least ${options.minCovered}, got ${covered.size}.`,
    );
    process.exitCode = 1;
  }
  if (options.minAliases !== null && coveredAliases.size < options.minAliases) {
    console.error(
      `Minimum exercised generated aliases not met: expected at least ${options.minAliases}, got ${coveredAliases.size}.`,
    );
    process.exitCode = 1;
  }
  if (options.requireGeneratedAliasFixtures && missingAliases.length > 0) {
    console.error(
      `Not all generated aliases have command-shape fixtures: ${missingAliases.length} unexercised.`,
    );
    process.exitCode = 1;
  }
  if (options.requireAll && missing.length > 0) {
    console.error(
      `Not all manifest operations are covered: ${missing.length} uncovered.`,
    );
    process.exitCode = 1;
  }
  if (
    options.requireGeneratedCommandFixtures &&
    missingCommandFixtures.length > 0
  ) {
    console.error(
      `Not all generated operations have command-shape fixtures: ${missingCommandFixtures.length} uncovered.`,
    );
    process.exitCode = 1;
  }
  if (
    options.requireCanonicalGeneratedCommandFixtures &&
    missingCanonicalCommandFixtures.length > 0
  ) {
    console.error(
      `Not all generated operations have canonical command-shape fixtures: ${missingCanonicalCommandFixtures.length} uncovered.`,
    );
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
