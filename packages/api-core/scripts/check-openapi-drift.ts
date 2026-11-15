/**
 * Report where openapi/primitive-api.yaml has drifted from the OpenAPI
 * document the API serves.
 *
 * Usage (from the repo root):
 *
 *   make openapi-drift                      # the production API's document
 *   make openapi-drift SERVED=<url or path> # another document
 *
 * The spec is meant to be `make openapi-sync` of the served document, plus
 * the few blocks listed in PREVIEW_ONLY below, which the preview CLI uses and
 * the served document does not carry yet. This runs the same sync on the
 * served document, compares the result with the committed spec, and lists
 * every difference that PREVIEW_ONLY does not explain.
 *
 * Exit status: 0 when nothing is left to report, 1 when there is drift to
 * resync, 2 when the comparison could not run (fetch, parse or sync failed).
 * It is a report for the next resync, not a merge check.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { syncOpenApi } from "./sync-openapi.ts";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const scriptDir = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(scriptDir, "../../../openapi/primitive-api.yaml");

export const DEFAULT_SERVED = "https://api.primitive.dev/v1/openapi";

/**
 * What the committed spec carries on purpose that the served document does
 * not. Each path is a location in the spec, in JSON pointer segments (do not
 * use the keyed array segments diffDocuments writes for named items).
 *
 * Only a difference at exactly that path is expected, so a block the served
 * document does not have at all (a spec-only path or schema) matches, and so
 * does a single changed value. Once the served document carries the block,
 * even in another shape, the differences move under the path: they are
 * reported as drift, and the entry, matching nothing, as stale. Keep this
 * short: every entry hides a real difference from the report.
 */
export const PREVIEW_ONLY: ReadonlyArray<{
  reason: string;
  paths: readonly string[];
}> = [
  {
    reason:
      "CLI user login: the preview CLI signs a person in and lists their orgs; the served document does not describe it yet.",
    paths: [
      "/paths/~1cli~1orgs",
      "/paths/~1cli~1login~1poll/post/description",
      "/paths/~1cli~1login~1poll/post/x-primitive-user-login-result",
      "/components/schemas/StartCliLoginInput/properties/login_kind",
      "/components/schemas/StartCliLoginInput/properties/requested_grant",
      "/components/schemas/CliUserLoginPollResult",
      "/components/schemas/CliOrgAccessToken",
      "/components/schemas/CliOrgRefusal",
      "/components/schemas/CliOrgRefusalReason",
      "/components/schemas/CliOrg",
      "/components/schemas/CliOrgList",
    ],
  },
  {
    reason:
      "Error details for grant_forbidden and step_up_required, which the preview CLI reads; the served document does not declare them yet.",
    paths: [
      "permission",
      "credential_kind",
      "grant_template_key",
      "credential_grant_id",
      "catalog_version",
      "reason",
      "purpose",
      "step_up_url",
    ].map(
      (name) =>
        `/components/schemas/ErrorResponse/properties/error/properties/details/properties/${name}`,
    ),
  },
];

export type DriftKind = "served-only" | "spec-only" | "changed";

export type Drift = {
  path: string;
  kind: DriftKind;
  /** Only a description or summary differs. */
  text: boolean;
  /** For a changed list of plain values: what each side has that the other lacks. */
  servedOnly?: Json[];
  specOnly?: Json[];
  /** For any other change that is not text: each side's value. */
  served?: Json;
  spec?: Json;
};

const TEXT_KEYS = new Set(["description", "summary"]);

function isObject(value: Json | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Key the items of an array of named objects (parameters by `in:name`, tags
 * by `name`), so an insertion does not shift every later item. Null when the
 * array is not such a list, or two items share a key.
 */
function keyedItems(items: Json[]): Map<string, Json> | null {
  const keyed = new Map<string, Json>();
  for (const item of items) {
    if (!isObject(item) || typeof item.name !== "string") return null;
    const key =
      typeof item.in === "string" ? `${item.in}:${item.name}` : item.name;
    if (keyed.has(key)) return null;
    keyed.set(key, item);
  }
  return keyed;
}

function isPlain(value: Json): boolean {
  return value === null || typeof value !== "object";
}

/** Every difference between the synced served document and the committed spec. */
export function diffDocuments(served: Json, spec: Json): Drift[] {
  const out: Drift[] = [];
  // A text key, not a property that happens to be named `description`.
  const isText = (path: string) => {
    const segments = path.split("/");
    return (
      TEXT_KEYS.has(segments[segments.length - 1]) &&
      segments[segments.length - 2] !== "properties"
    );
  };

  const walk = (a: Json, b: Json, path: string): void => {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.every(isPlain) && b.every(isPlain)) {
        const sa = a.map((v) => JSON.stringify(v));
        const sb = b.map((v) => JSON.stringify(v));
        const servedOnly = a.filter((_, i) => !sb.includes(sa[i]));
        const specOnly = b.filter((_, i) => !sa.includes(sb[i]));
        // Order alone (an enum or `required` reordered) is not drift.
        if (servedOnly.length > 0 || specOnly.length > 0) {
          out.push({
            path,
            kind: "changed",
            text: false,
            servedOnly,
            specOnly,
          });
        }
        return;
      }
      const ka = keyedItems(a);
      const kb = keyedItems(b);
      if (ka && kb) {
        for (const key of new Set([...ka.keys(), ...kb.keys()])) {
          const p = `${path}/${escapeSegment(key)}`;
          if (!kb.has(key))
            out.push({ path: p, kind: "served-only", text: false });
          else if (!ka.has(key))
            out.push({ path: p, kind: "spec-only", text: false });
          else walk(ka.get(key) as Json, kb.get(key) as Json, p);
        }
        return;
      }
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const p = `${path}/${i}`;
        if (i >= b.length)
          out.push({ path: p, kind: "served-only", text: false });
        else if (i >= a.length)
          out.push({ path: p, kind: "spec-only", text: false });
        else walk(a[i], b[i], p);
      }
      return;
    }
    if (isObject(a) && isObject(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const p = `${path}/${escapeSegment(key)}`;
        if (!Object.hasOwn(b, key))
          out.push({ path: p, kind: "served-only", text: isText(p) });
        else if (!Object.hasOwn(a, key))
          out.push({ path: p, kind: "spec-only", text: isText(p) });
        else walk(a[key], b[key], p);
      }
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      const text = isText(path);
      out.push(
        text
          ? { path, kind: "changed", text }
          : { path, kind: "changed", text, served: a, spec: b },
      );
    }
  };

  walk(served, spec, "");
  return out;
}

export type DriftReport = {
  drift: Drift[];
  expected: Drift[];
  /** PREVIEW_ONLY paths that match no difference. */
  stale: string[];
};

export function classify(
  differences: Drift[],
  allowlist: typeof PREVIEW_ONLY = PREVIEW_ONLY,
): DriftReport {
  const allowed = allowlist.flatMap((entry) => entry.paths);
  const used = new Set<string>();
  const drift: Drift[] = [];
  const expected: Drift[] = [];
  for (const difference of differences) {
    const match = allowed.find((path) => difference.path === path);
    if (match) {
      used.add(match);
      expected.push(difference);
    } else {
      drift.push(difference);
    }
  }
  return { drift, expected, stale: allowed.filter((path) => !used.has(path)) };
}

/** The operation or component a path belongs to, for grouping the report. */
function owner(path: string): string {
  const segments = path.split("/");
  const depth =
    segments[1] === "paths" ? 4 : segments[1] === "components" ? 4 : 2;
  return segments.slice(0, depth).join("/");
}

function brief(value: Json | undefined): string {
  const text = JSON.stringify(value) ?? "undefined";
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function line(d: Drift, base: string): string {
  const rest = d.path.slice(base.length) || "(whole)";
  let text = `- ${d.kind} \`${rest}\``;
  if (d.servedOnly?.length)
    text += ` served adds ${JSON.stringify(d.servedOnly)}`;
  if (d.specOnly?.length) text += ` spec adds ${JSON.stringify(d.specOnly)}`;
  if ("served" in d)
    text += ` served ${brief(d.served)}, spec ${brief(d.spec)}`;
  return text;
}

export function renderReport(report: DriftReport, served: string): string {
  const out: string[] = [
    "# Preview spec drift",
    "",
    `Served document: ${served}`,
    "",
  ];
  const structural = report.drift.filter((d) => !d.text);
  const text = report.drift.filter((d) => d.text);
  out.push(
    `${structural.length} structural differences and ${text.length} description changes to resync; ` +
      `${report.expected.length} expected (PREVIEW_ONLY).`,
    "",
  );
  const section = (title: string, items: Drift[]) => {
    if (items.length === 0) return;
    out.push(`## ${title}`, "");
    const groups = new Map<string, Drift[]>();
    for (const d of items) {
      const key = owner(d.path);
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
    for (const [key, group] of groups) {
      out.push(`### \`${key}\``, "", ...group.map((d) => line(d, key)), "");
    }
  };
  section("Structural", structural);
  section("Descriptions", text);
  if (report.stale.length > 0) {
    out.push(
      "## PREVIEW_ONLY entries that matched nothing",
      "",
      "The served document now agrees here; delete these entries.",
      "",
      ...report.stale.map((path) => `- \`${path}\``),
      "",
    );
  }
  out.push(
    "`served-only`: the served document has it and the spec does not. `spec-only`: the reverse. " +
      "Resync with `make openapi-sync` (see RELEASE.md).",
  );
  return out.join("\n");
}

async function loadServed(source: string): Promise<JsonObject> {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new Error(`GET ${source} answered ${response.status}`);
    return (await response.json()) as JsonObject;
  }
  return JSON.parse(readFileSync(resolve(source), "utf8")) as JsonObject;
}

/** The whole check; resolves to the exit status. */
export async function run(source: string): Promise<number> {
  let report: DriftReport;
  try {
    const synced = syncOpenApi(await loadServed(source));
    const spec = YAML.parse(readFileSync(specPath, "utf8")) as JsonObject;
    report = classify(diffDocuments(synced, spec));
  } catch (error) {
    console.error(
      `could not compare: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }
  const markdown = renderReport(report, source);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
    } catch (error) {
      console.error(`could not write the step summary: ${String(error)}`);
    }
  }
  if (report.drift.length > 0 || report.stale.length > 0) {
    console.log(
      `::warning title=Preview spec drift::${report.drift.length} differences from the served document, ${report.stale.length} stale PREVIEW_ONLY entries`,
    );
    return 1;
  }
  return 0;
}

// Run only as a script, so the test can import the functions above.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run(process.argv[2] || DEFAULT_SERVED).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error);
      process.exit(2);
    },
  );
}
