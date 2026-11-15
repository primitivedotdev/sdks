// Run with: pnpm --filter @primitivedotdev/api-core test:scripts
// Importing the script must not run it: it fetches the served document.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  classify,
  diffDocuments,
  PREVIEW_ONLY,
  renderReport,
  run,
} from "./check-openapi-drift.ts";
import { syncOpenApi } from "./sync-openapi.ts";

const served = () => ({
  openapi: "3.1.0",
  info: { title: "t", version: "1" },
  tags: [{ name: "emails", description: "Mail." }],
  paths: {
    "/emails": {
      get: {
        operationId: "listEmails",
        description: "List emails.",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Email" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Email: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["a", "b"] },
          description: { type: "string" },
        },
        required: ["status"],
      },
    },
  },
});

describe("diffDocuments", () => {
  it("finds nothing when the spec is the sync of the served document", () => {
    const synced = syncOpenApi(served());
    const spec = YAML.parse(YAML.stringify(synced));
    assert.deepEqual(diffDocuments(synced, spec), []);
  });

  it("keys parameters by in and name, so an insertion is one finding", () => {
    const a = served();
    const b = served();
    b.paths["/emails"].get.parameters.unshift({
      name: "mine",
      in: "query",
      schema: { type: "string" },
    });
    assert.deepEqual(diffDocuments(a, b), [
      {
        path: "/paths/~1emails/get/parameters/query:mine",
        kind: "spec-only",
        text: false,
      },
    ]);
  });

  it("ignores order in a list of plain values and reports what each side adds", () => {
    const a = served();
    const b = served();
    b.components.schemas.Email.properties.status.enum = ["b", "a"];
    assert.deepEqual(diffDocuments(a, b), []);
    b.components.schemas.Email.properties.status.enum = ["b", "c"];
    assert.deepEqual(diffDocuments(a, b), [
      {
        path: "/components/schemas/Email/properties/status/enum",
        kind: "changed",
        text: false,
        servedOnly: ["a"],
        specOnly: ["c"],
      },
    ]);
  });

  it("marks description changes as text, but not a property named description", () => {
    const a = served();
    const b = served();
    b.paths["/emails"].get.description = "List the emails.";
    b.tags[0].description = "Email.";
    delete (b.components.schemas.Email.properties as Record<string, unknown>)
      .description;
    const found = diffDocuments(a, b);
    assert.deepEqual(
      found.map((d) => [d.path, d.kind, d.text]),
      [
        ["/tags/emails/description", "changed", true],
        ["/paths/~1emails/get/description", "changed", true],
        [
          "/components/schemas/Email/properties/description",
          "served-only",
          false,
        ],
      ],
    );
  });

  it("gives both values of a changed scalar that is not text", () => {
    const a = served();
    const b = served();
    (b.components.schemas.Email.properties.status as { type: unknown }).type = [
      "string",
      "null",
    ];
    assert.deepEqual(diffDocuments(a, b), [
      {
        path: "/components/schemas/Email/properties/status/type",
        kind: "changed",
        text: false,
        served: "string",
        spec: ["string", "null"],
      },
    ]);
  });
});

describe("diffDocuments edge cases", () => {
  it("escapes / and ~ in keys as JSON pointer segments", () => {
    assert.deepEqual(diffDocuments({ "a/b~c": 1 }, {}), [
      { path: "/a~1b~0c", kind: "served-only", text: false },
    ]);
  });

  it("compares a list of data values by position, and only set keywords as sets", () => {
    assert.deepEqual(
      diffDocuments(
        { const: ["a", "b"], type: ["string", "null"] },
        { const: ["b", "a"], type: ["null", "string"] },
      ),
      [
        {
          path: "/const",
          kind: "changed",
          text: false,
          served: ["a", "b"],
          spec: ["b", "a"],
        },
      ],
    );
    // The `required` of a property named `properties` is still the keyword.
    assert.deepEqual(
      diffDocuments(
        { properties: { properties: { required: ["a", "b"] } } },
        { properties: { properties: { required: ["b", "a", "a"] } } },
      ),
      [],
    );
    // A key named `type` inside an example is data.
    assert.deepEqual(
      diffDocuments(
        { examples: [{ type: ["a", "b"] }] },
        { examples: [{ type: ["b", "a"] }] },
      ),
      [
        {
          path: "/examples/0/type",
          kind: "changed",
          text: false,
          served: ["a", "b"],
          spec: ["b", "a"],
        },
      ],
    );
    // A property named `default` is a schema, so its `type` is the keyword.
    assert.deepEqual(
      diffDocuments(
        { properties: { default: { type: ["string", "null"] } } },
        { properties: { default: { type: ["null", "string"] } } },
      ),
      [],
    );
    // A value repeated on one side is listed once.
    assert.deepEqual(
      diffDocuments({ required: ["b", "b"] }, { required: [] }),
      [
        {
          path: "/required",
          kind: "changed",
          text: false,
          servedOnly: ["b"],
          specOnly: [],
        },
      ],
    );
  });

  it("reports an array against an object once, as changed", () => {
    assert.deepEqual(diffDocuments({ x: [1] }, { x: { a: 1 } }), [
      {
        path: "/x",
        kind: "changed",
        text: false,
        served: [1],
        spec: { a: 1 },
      },
    ]);
  });

  it("keys an added parameter even when the other side has none", () => {
    assert.deepEqual(
      diffDocuments(
        { parameters: [] },
        { parameters: [{ name: "mine", in: "query" }] },
      ),
      [{ path: "/parameters/query:mine", kind: "spec-only", text: false }],
    );
  });
});

describe("run", () => {
  it("exits 2 when the served document cannot be read", async () => {
    assert.equal(await run("/nonexistent/served-openapi.json"), 2);
  });
});

describe("classify", () => {
  const allowlist = [
    {
      reason: "preview only",
      paths: ["/components/schemas/CliOrg", "/paths/~1cli~1orgs"],
    },
  ];

  it("expects a difference at exactly an allowlisted path, and nowhere else", () => {
    const report = classify(
      [
        { path: "/components/schemas/CliOrg", kind: "spec-only", text: false },
        {
          path: "/components/schemas/CliOrgList",
          kind: "spec-only",
          text: false,
        },
        { path: "/paths/~1cli~1orgs", kind: "spec-only", text: false },
      ],
      allowlist,
    );
    assert.deepEqual(
      report.expected.map((d) => d.path),
      ["/components/schemas/CliOrg", "/paths/~1cli~1orgs"],
    );
    // A prefix of a name is not a match.
    assert.deepEqual(
      report.drift.map((d) => d.path),
      ["/components/schemas/CliOrgList"],
    );
    assert.deepEqual(report.stale, []);
  });

  it("reports drift under an entry once the served document carries the block, and the entry as stale", () => {
    // The served document now has /cli/orgs, in a shape that differs from the spec's.
    const report = classify(
      [
        {
          path: "/paths/~1cli~1orgs/get/description",
          kind: "changed",
          text: true,
        },
      ],
      allowlist,
    );
    assert.deepEqual(
      report.drift.map((d) => d.path),
      ["/paths/~1cli~1orgs/get/description"],
    );
    assert.deepEqual(report.stale, [
      "/components/schemas/CliOrg",
      "/paths/~1cli~1orgs",
    ]);
  });

  it("reports an allowlisted path that matches nothing as stale", () => {
    const report = classify([], allowlist);
    assert.deepEqual(report.stale, [
      "/components/schemas/CliOrg",
      "/paths/~1cli~1orgs",
    ]);
    assert.match(renderReport(report, "x"), /delete these entries/);
  });
});

describe("PREVIEW_ONLY", () => {
  it("names only locations the committed spec has", () => {
    const specPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../openapi/primitive-api.yaml",
    );
    const spec = YAML.parse(readFileSync(specPath, "utf8"));
    const lookup = (path: string) =>
      path
        .split("/")
        .slice(1)
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
        .reduce<unknown>(
          (node, key) =>
            node !== null && typeof node === "object"
              ? (node as Record<string, unknown>)[key]
              : undefined,
          spec,
        );
    for (const path of PREVIEW_ONLY.flatMap((entry) => entry.paths)) {
      assert.notEqual(lookup(path), undefined, path);
    }
  });
});
