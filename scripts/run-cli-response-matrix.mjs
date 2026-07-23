#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const DEFAULT_CASES = path.join(
  REPO_ROOT,
  "test-fixtures/cli-parity/cases.json",
);
const DEFAULT_MANIFEST = path.join(
  REPO_ROOT,
  "cli-rust/src/operation-manifest.json",
);
const DEFAULT_OPENAPI = path.join(REPO_ROOT, "openapi/primitive-api.codegen.json");
const PARITY_RUNNER = path.join(REPO_ROOT, "scripts/run-cli-parity.mjs");

const FALLBACK_JSON_ERROR_STATUSES = [
  400, 401, 402, 403, 404, 409, 410, 422, 424, 429, 500, 502, 503, 504,
];

const ERROR_CODE_BY_STATUS = new Map([
  [400, "bad_request"],
  [401, "unauthorized"],
  [402, "payment_required"],
  [403, "forbidden"],
  [404, "not_found"],
  [409, "conflict"],
  [410, "gone"],
  [422, "validation_error"],
  [424, "failed_dependency"],
  [429, "rate_limited"],
  [500, "internal_server_error"],
  [502, "bad_gateway"],
  [503, "service_unavailable"],
  [504, "gateway_timeout"],
]);

const SUCCESS_BODY_FAMILIES = [
  {
    name: "malformed-json",
    body: "{\"success\": true, \"data\": ",
    status: 200,
    expectedJsonExit: 1,
    response: () => ({
      status: 200,
      headers: { "content-type": "application/json" },
      body: "{\"success\": true, \"data\": ",
    }),
  },
  {
    name: "text-plain",
    body: "plain text response from parity matrix",
    status: 200,
    response: () => ({
      status: 200,
      headers: { "content-type": "text/plain" },
      body: "plain text response from parity matrix",
    }),
  },
];

const ERROR_BODY_FAMILIES = [
  {
    name: "malformed-json-error",
    status: 500,
    response: () => ({
      status: 500,
      headers: { "content-type": "application/json" },
      body: "{\"success\": false, \"error\": ",
    }),
  },
  {
    name: "text-plain-error",
    status: 502,
    response: () => ({
      status: 502,
      headers: { "content-type": "text/plain" },
      body: "upstream text error from parity matrix",
    }),
  },
  {
    name: "empty-body-error",
    status: 503,
    response: () => ({
      status: 503,
      headers: { "content-type": "application/json" },
      body: "",
    }),
  },
];

function responseFamilies(jsonErrorStatuses = FALLBACK_JSON_ERROR_STATUSES) {
  return [
    ...jsonErrorStatuses.map((status) => ({
      name: `${status}-json-error`,
      status,
      response: (operation) =>
        jsonErrorResponse(
          status,
          ERROR_CODE_BY_STATUS.get(status) ?? `http_${status}`,
          operation,
        ),
    })),
    ...SUCCESS_BODY_FAMILIES,
    ...ERROR_BODY_FAMILIES,
  ];
}

function jsonErrorResponse(status, code, operation) {
  return {
    status,
    json: {
      success: false,
      error: {
        code,
        message: `Response matrix ${status} for ${operation.operationId}`,
      },
    },
  };
}

function usage() {
  return `Usage:
  node scripts/run-cli-response-matrix.mjs --node-bin "node cli-node/bin/run.js" --rust-bin "cli-rust/target/debug/primitive"

Options:
  --cases <path>       Seed parity fixture file. Defaults to test-fixtures/cli-parity/cases.json
  --manifest <path>    Operation manifest. Defaults to cli-rust/src/operation-manifest.json
  --openapi <path>     OpenAPI JSON used to discover error statuses. Defaults to openapi/primitive-api.codegen.json
  --family <name>      Response family to include. Repeatable.
  --operation <id>     Operation id to include. Repeatable.
  --node-bin <command> Node CLI command. Can also use NODE_CLI.
  --rust-bin <command> Rust CLI command. Can also use RUST_CLI.
  --out <path>         Write the generated fixture to this path.
  --allow-noncanonical Allow a seed whose args do not start with the manifest command.
  --keep-tmp           Keep the generated temporary fixture.
  --verbose            Pass --verbose to the parity runner.
  --list-families      Print available response families and exit.
`;
}

function parseArgs(argv) {
  const options = {
    allowNoncanonical: false,
    casesPath: DEFAULT_CASES,
    families: [],
    keepTmp: false,
    manifestPath: DEFAULT_MANIFEST,
    nodeCli: process.env.NODE_CLI,
    openapiPath: DEFAULT_OPENAPI,
    operations: [],
    outPath: null,
    rustCli: process.env.RUST_CLI,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--list-families") {
      const openapiPath = path.resolve(
        argv[index + 1] && !argv[index + 1].startsWith("-")
          ? argv[index + 1]
          : DEFAULT_OPENAPI,
      );
      for (const family of responseFamilies(errorStatusesFromOpenApi(openapiPath))) {
        console.log(family.name);
      }
      process.exit(0);
    }
    if (arg === "--keep-tmp") {
      options.keepTmp = true;
      continue;
    }
    if (arg === "--allow-noncanonical") {
      options.allowNoncanonical = true;
      continue;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) throw new Error(`Missing value for ${arg}`);
    if (arg === "--cases") {
      options.casesPath = path.resolve(next);
    } else if (arg === "--manifest") {
      options.manifestPath = path.resolve(next);
    } else if (arg === "--openapi") {
      options.openapiPath = path.resolve(next);
    } else if (arg === "--family") {
      options.families.push(next);
    } else if (arg === "--operation") {
      options.operations.push(next);
    } else if (arg === "--node-cli" || arg === "--node-bin") {
      options.nodeCli = next;
    } else if (arg === "--rust-cli" || arg === "--rust-bin") {
      options.rustCli = next;
    } else if (arg === "--out") {
      options.outPath = path.resolve(next);
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
    index += 1;
  }

  if (!options.nodeCli || !options.rustCli) {
    throw new Error("Both --node-bin and --rust-bin are required.");
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function errorStatusesFromOpenApi(openapiPath) {
  const spec = readJson(openapiPath);
  const statuses = new Set(FALLBACK_JSON_ERROR_STATUSES);
  for (const pathItem of Object.values(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== "object") continue;
      for (const status of Object.keys(operation.responses ?? {})) {
        if (/^[0-9]{3}$/.test(status) && Number(status) >= 400) {
          statuses.add(Number(status));
        }
      }
    }
  }
  return [...statuses].sort((left, right) => left - right);
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
  const parts = manifestFixturePath(template).split("/");
  const source = parts
    .map((part) => (/^\{[^/{}]+\}$/.test(part) ? "[^/]+" : escapeRegex(part)))
    .join("/");
  return new RegExp(`^${source}$`);
}

function commandId(operation) {
  return `${operation.tagCommand}:${operation.command}`;
}

function commandForms(operation) {
  const id = commandId(operation);
  return [id, id.split(":").join(" ")];
}

function fixtureUsesCommandForm(args, form) {
  if (!Array.isArray(args) || args.length === 0) return false;
  const parts = form.split(" ");
  return args.slice(0, parts.length).join(" ") === form;
}

function fixtureRequestCandidates(cases, operation) {
  const method = operation.method.toUpperCase();
  const pathRegex = pathTemplateRegex(operation.path);
  const forms = commandForms(operation);
  const candidates = [];

  cases.forEach((caseItem, caseIndex) => {
    for (const [requestIndex, request] of (
      caseItem.expect?.requests ?? []
    ).entries()) {
      if (
        request.method === method &&
        typeof request.path === "string" &&
        pathRegex.test(request.path)
      ) {
        candidates.push({
          caseIndex,
          caseItem,
          canonical: forms.some((form) =>
            fixtureUsesCommandForm(caseItem.args, form),
          ),
          requestIndex,
        });
      }
    }
  });
  return candidates;
}

function selectSeed(cases, operation) {
  const candidates = fixtureRequestCandidates(cases, operation).filter(
    ({ caseItem, requestIndex }) =>
      Array.isArray(caseItem.server?.exchanges) &&
      caseItem.server.exchanges.length > requestIndex,
  );
  const exactStrict = ({ caseItem, canonical }) =>
    canonical &&
    (caseItem.expect?.requests?.length ?? 0) === 1 &&
    caseItem.compare !== false &&
    !caseItem.expectByRunner;
  return (
    candidates.find(exactStrict) ??
    candidates.find(
      ({ caseItem, canonical }) =>
        canonical &&
        (caseItem.expect?.requests?.length ?? 0) === 1 &&
        caseItem.compare !== false,
    ) ??
    candidates.find(({ caseItem, canonical }) => canonical && caseItem.compare !== false) ??
    candidates.find(({ canonical }) => canonical) ??
    candidates[0] ??
    null
  );
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function outputFileSpecs(files) {
  return Object.keys(files ?? {});
}

function binarySuccessOutputFiles(seed, operation, family) {
  if (!operation.binaryResponse || family.status !== 200 || family.body === undefined) {
    return undefined;
  }

  const paths = outputFileSpecs(seed.caseItem.expect?.files);
  if (paths.length === 0) return undefined;
  return Object.fromEntries(paths.map((filePath) => [filePath, family.body]));
}

function expectedExitCodeForFamily(operation, family) {
  if (family.status >= 400) return 1;
  if (operation.binaryResponse) return 0;
  return family.expectedJsonExit ?? "any";
}

function expectedSideEffects(seed, operation, family) {
  if (family.status >= 400) {
    return {
      configFilesAbsent: outputFileSpecs(seed.caseItem.expect?.configFiles),
      filesAbsent: outputFileSpecs(seed.caseItem.expect?.files),
    };
  }
  return {
    files: binarySuccessOutputFiles(seed, operation, family),
  };
}

function skipFamily(operation, family) {
  if (
    operation.operationId === "testFunction" &&
      (family.name === "malformed-json" || family.name === "text-plain")
  ) {
    return "custom functions:test-function invalid 200 body handling is unstable in the Node CLI harness";
  }
  return null;
}

function extraErrorPathExchanges(seed, operation, family) {
  const request = seed.caseItem.expect?.requests?.[seed.requestIndex];
  if (
    operation.operationId !== "testEndpoint" ||
    family.name !== "404-json-error" ||
    !request
  ) {
    return { exchanges: [], requests: [] };
  }

  const endpointId = request.path.match(/^\/v1\/endpoints\/([^/]+)\/test$/)?.[1];
  if (!endpointId) return { exchanges: [], requests: [] };

  return {
    exchanges: [
      {
        response: {
          bodyJson: {
            success: true,
            data: [
              {
                id: endpointId,
                kind: "function",
                function_id: "fn_response_matrix",
                url: null,
              },
            ],
          },
        },
      },
    ],
    requests: [
      {
        method: "GET",
        path: "/v1/endpoints",
        headers: request.headers,
      },
    ],
  };
}

function matrixCase(seed, operation, family) {
  const caseItem = cloneJson(seed.caseItem);
  const exchanges = cloneJson(caseItem.server?.exchanges ?? []);
  exchanges[seed.requestIndex] = {
    ...(exchanges[seed.requestIndex] ?? {}),
    response: family.response(operation),
  };
  const extra = extraErrorPathExchanges(seed, operation, family);

  const requests = cloneJson(caseItem.expect?.requests ?? []).slice(
    0,
    seed.requestIndex + 1,
  );
  requests.push(...extra.requests);
  const exchangeSlice = exchanges.slice(0, seed.requestIndex + 1);
  exchangeSlice.push(...extra.exchanges);
  const sideEffects = expectedSideEffects(seed, operation, family);

  return {
    name: `response matrix ${operation.operationId} ${family.name}`,
    args: caseItem.args,
    compare: true,
    configFiles: caseItem.configFiles,
    env: caseItem.env,
    files: caseItem.files,
    normalize: caseItem.normalize,
    server: { exchanges: exchangeSlice },
    stdin: caseItem.stdin,
    expect: {
      exitCode: expectedExitCodeForFamily(operation, family),
      ...sideEffects,
      requests,
    },
  };
}

function selectedFamilies(options, families) {
  if (options.families.length === 0) return families;
  const byName = new Map(families.map((family) => [family.name, family]));
  return options.families.map((name) => {
    const family = byName.get(name);
    if (!family) {
      throw new Error(
        `Unknown response family ${JSON.stringify(name)}. Run --list-families.`,
      );
    }
    return family;
  });
}

function selectedOperations(manifest, options) {
  if (options.operations.length === 0) return manifest;
  const requested = new Set(options.operations);
  const selected = manifest.filter((operation) =>
    requested.has(operation.operationId),
  );
  const missing = [...requested].filter(
    (operationId) =>
      !selected.some((operation) => operation.operationId === operationId),
  );
  if (missing.length > 0) {
    throw new Error(`Unknown operation id(s): ${missing.join(", ")}`);
  }
  return selected;
}

function generateMatrix(options) {
  const casesDocument = readJson(options.casesPath);
  const cases = casesDocument.cases;
  if (!Array.isArray(cases)) {
    throw new Error("Seed fixture file must contain a cases array.");
  }
  const manifest = readJson(options.manifestPath);
  if (!Array.isArray(manifest)) {
    throw new Error("Operation manifest must be an array.");
  }

  const jsonErrorStatuses = errorStatusesFromOpenApi(options.openapiPath);
  const families = selectedFamilies(options, responseFamilies(jsonErrorStatuses));
  const operations = selectedOperations(manifest, options);
  const matrixCases = [];
  const seeds = [];
  const skipped = [];

  for (const operation of operations) {
    const seed = selectSeed(cases, operation);
    if (!seed) {
      throw new Error(
        `No mock-backed seed fixture found for ${operation.operationId} (${operation.method} ${operation.path}).`,
      );
    }
    if (!seed.canonical && !options.allowNoncanonical) {
      throw new Error(
        [
          `Noncanonical seed fixture selected for ${operation.operationId}: ${seed.caseItem.name}`,
          `  args: ${(seed.caseItem.args ?? []).join(" ")}`,
          `  expected one of: ${commandForms(operation).join(" OR ")}`,
          "Add a canonical mock-backed fixture or rerun with --allow-noncanonical.",
        ].join("\n"),
      );
    }
    seeds.push({
      canonical: seed.canonical,
      operationId: operation.operationId,
      requestIndex: seed.requestIndex,
      seedName: seed.caseItem.name,
    });
    for (const family of families) {
      const skip = skipFamily(operation, family);
      if (skip) {
        skipped.push({
          family: family.name,
          operationId: operation.operationId,
          reason: skip,
        });
        continue;
      }
      matrixCases.push(matrixCase(seed, operation, family));
    }
  }

  return {
    cases: matrixCases,
    meta: {
      families: families.map((family) => family.name),
      generatedAt: new Date(0).toISOString(),
      jsonErrorStatuses,
      operations: operations.map((operation) => operation.operationId),
      seeds,
      skipped,
    },
  };
}

function writeMatrixFixture(matrix, options) {
  if (options.outPath) {
    writeFileSync(options.outPath, `${JSON.stringify(matrix, null, 2)}\n`);
    return { cleanup: false, path: options.outPath };
  }
  const tmpRoot = mkdtempSync(path.join(tmpdir(), "primitive-cli-matrix-"));
  const fixturePath = path.join(tmpRoot, "cases.json");
  writeFileSync(fixturePath, `${JSON.stringify(matrix, null, 2)}\n`);
  return { cleanup: !options.keepTmp, path: fixturePath, tmpRoot };
}

function runParity(options, fixturePath) {
  const args = [
    PARITY_RUNNER,
    "--cases",
    fixturePath,
    "--node-bin",
    options.nodeCli,
    "--rust-bin",
    options.rustCli,
  ];
  if (options.verbose) args.push("--verbose");
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const matrix = generateMatrix(options);
  const fixture = writeMatrixFixture(matrix, options);
  console.error(
    `Generated ${matrix.cases.length} CLI response matrix case(s) for ${matrix.meta.operations.length} operation(s) across ${matrix.meta.families.length} response family/families.`,
  );
  if (options.outPath || options.keepTmp) {
    console.error(`Generated fixture: ${fixture.path}`);
  }

  try {
    process.exitCode = runParity(options, fixture.path);
  } finally {
    if (fixture.cleanup) rmSync(fixture.tmpRoot, { force: true, recursive: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
