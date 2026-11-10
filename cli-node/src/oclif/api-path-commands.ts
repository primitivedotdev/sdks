import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "@primitivedotdev/api-core";

// Server messages sometimes point at an API route ("see GET
// /v1/email-rule-scope-options"). A CLI user cannot run an HTTP verb, so the
// CLI names the command that calls that route next to it.

/**
 * The hand-rolled command that covers an operation, where the CLI offers one
 * instead of (or as well as) the generated command.
 */
const PREFERRED_COMMANDS: Readonly<Record<string, string>> = {
  createKey: "keys:create",
  rotateKey: "keys:rotate",
  updateKey: "keys:update",
  revokeCredential: "keys:revoke",
  listKeys: "keys:list",
  getKey: "keys:get",
  setFunctionRoute: "functions:route-set",
  unsetFunctionRoute: "functions:route-unset",
  getOrgRoutingTopology: "functions:routing-topology",
};

/** Commands the CLI offers, by id; set once the command table is built. */
let knownCommands: ReadonlySet<string> = new Set();
/** A short name for a generated command, where one exists in its own topic. */
let shortNames: ReadonlyMap<string, string> = new Map();

export function setKnownCommands(
  ids: Iterable<string>,
  aliases: Readonly<Record<string, string>> = {},
): void {
  knownCommands = new Set(ids);
  const short = new Map<string, string>();
  for (const [alias, target] of Object.entries(aliases)) {
    // An alias in another topic is a name kept for an older id, not a short one.
    if (alias.split(":")[0] !== target.split(":")[0]) continue;
    const current = short.get(target);
    if (current === undefined || alias.length < current.length) {
      short.set(target, alias);
    }
  }
  shortNames = short;
}

type Route = {
  method: string;
  pattern: RegExp;
  /** How many of the path's segments are fixed: the more, the closer the match. */
  fixed: number;
  operation: PrimitiveOperationManifest;
};

let routes: Route[] | undefined;

function routeTable(): Route[] {
  routes ??= operationManifest.map((operation) => {
    const segments = operation.path.split("/");
    return {
      method: operation.method.toUpperCase(),
      pattern: new RegExp(
        `^${segments
          .map((segment) =>
            /^\{[^}]+\}$/.test(segment)
              ? "[^/]+"
              : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          )
          .join("/")}$`,
      ),
      fixed: segments.filter((segment) => !/^\{[^}]+\}$/.test(segment)).length,
      operation,
    };
  });
  return routes;
}

function commandId(operation: PrimitiveOperationManifest): string | undefined {
  // The API refuses the CLI on a dashboard-only operation, so no command calls it.
  if ((operation as { access?: unknown }).access === "session")
    return undefined;
  const preferred = PREFERRED_COMMANDS[operation.sdkName];
  if (preferred && knownCommands.has(preferred)) return preferred;
  const generated = `${operation.tagCommand}:${operation.command}`;
  const id = shortNames.get(generated) ?? generated;
  return knownCommands.has(id) ? id : undefined;
}

/** The CLI command for an API route, as `primitive <topic> <command>`, if the CLI has one. */
export function commandForRoute(
  method: string,
  path: string,
): string | undefined {
  const bare = path.replace(/^\/v1(?=\/)/, "").replace(/[?#].*$/, "");
  const verb = method.toUpperCase();
  // A fixed route (`/emails/search`) wins over a parameter route at the same
  // place (`/emails/{id}`).
  const route = routeTable()
    .filter(
      (candidate) => candidate.method === verb && candidate.pattern.test(bare),
    )
    .sort((left, right) => right.fixed - left.fixed)[0];
  const id = route ? commandId(route.operation) : undefined;
  return id ? `primitive ${id.replaceAll(":", " ")}` : undefined;
}

const ROUTE_IN_TEXT =
  /\b(GET|POST|PUT|PATCH|DELETE) (\/v1\/[A-Za-z0-9_\-/{}.:@%+]*[A-Za-z0-9_\-/{}@%+])(?![A-Za-z0-9_\-/{}@%+])/g;

/**
 * The text with each API route it names followed by its CLI command, for
 * example `GET /v1/email-rule-scope-options (primitive email-rules
 * list-email-rule-scope-options)`. Routes the CLI has no command for, and
 * text that names none, are left as they are.
 */
export function withCliCommands(text: string): string {
  return text.replace(ROUTE_IN_TEXT, (match, method: string, path: string) => {
    const command = commandForRoute(method, path);
    return command ? `${match} (${command})` : match;
  });
}

/** One hint line per API route the text names that the CLI has a command for. */
export function cliCommandLines(text: string): string[] {
  const lines: string[] = [];
  for (const [match, method, path] of text.matchAll(ROUTE_IN_TEXT)) {
    const command = commandForRoute(method as string, path as string);
    const line = command ? `Hint: in the CLI, ${match} is \`${command}\`.` : "";
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines;
}
