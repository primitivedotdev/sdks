// --scope-address and --scope-domain: a selected scope's inboxes and domains,
// on the email-rules commands whose request takes evaluation_scope. They set
// scope_selection, an object the generated per-field flags cannot express:
//
//   primitive email-rules create-email-rule ... --evaluation-scope selected \
//     --scope-address support@example.com --scope-domain example.org
//
// They set scope_selection as a whole, over any in --raw-body or --body-file,
// like the other flags that set a body field. When only one of the two flags
// is given, the other list is sent empty. scope_selection goes only with
// evaluation_scope selected, so they are refused unless the request sends
// selected: --evaluation-scope, or else evaluation_scope in --raw-body or
// --body-file, as the body is merged.
//
// This module does not import api-command.ts.

import { Errors, Flags } from "@oclif/core";
import type { ExtensionBodyField } from "./operation-extension.js";

export const SCOPE_ADDRESS_FLAG = "scope-address";
export const SCOPE_DOMAIN_FLAG = "scope-domain";

// The patterns the request schema gives scope_selection's items.
const ADDRESS = /^[^\s@]+@[^\s@]+$/;
const DOMAIN = /^[^\s@]+\.[^\s@]+$/;

const SCOPE_FLAG_NOTE = `Goes with --evaluation-scope selected (the flag, or evaluation_scope selected in --raw-body or --body-file). --${SCOPE_ADDRESS_FLAG} and --${SCOPE_DOMAIN_FLAG} set scope_selection as a whole, over any in --raw-body or --body-file, and a list not given is sent empty.`;

/**
 * The two flags, made anew for each command. Each value is its own flag
 * (`--scope-address a --scope-address b`) or a comma list, so a value after
 * them, such as a rule id given as the first argument, stays an argument.
 */
export function scopeSelectionFlags(): Record<string, unknown> {
  return {
    [SCOPE_ADDRESS_FLAG]: Flags.string({
      description: `An inbox the selected scope covers, such as support@example.com, in scope_selection.addresses: repeat the flag or give a comma list. ${SCOPE_FLAG_NOTE}`,
      multiple: true,
      multipleNonGreedy: true,
    }),
    [SCOPE_DOMAIN_FLAG]: Flags.string({
      description: `A domain the selected scope covers (each address there that you read), such as example.com, in scope_selection.domains: repeat the flag or give a comma list. ${SCOPE_FLAG_NOTE}`,
      multiple: true,
      multipleNonGreedy: true,
    }),
  };
}

function usageError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 2 });
}

/**
 * The values of a repeatable, comma-separated scope flag, trimmed, in the
 * order given and without repeats (compared without case). Undefined when the
 * flag was not given.
 */
function scopeList(
  values: unknown,
  flag: string,
  check: (value: string) => void,
): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const list: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const raw of String(value).split(",")) {
      const item = raw.trim();
      if (item === "") continue;
      check(item);
      if (seen.has(item.toLowerCase())) continue;
      seen.add(item.toLowerCase());
      list.push(item);
    }
  }
  if (list.length === 0) throw usageError(`--${flag} needs a value.`);
  return list;
}

function checkAddress(value: string): void {
  if (ADDRESS.test(value)) return;
  throw usageError(
    DOMAIN.test(value)
      ? `--${SCOPE_ADDRESS_FLAG} takes inboxes such as support@example.com; "${value}" is a domain, so give it with --${SCOPE_DOMAIN_FLAG}.`
      : `--${SCOPE_ADDRESS_FLAG} takes inboxes such as support@example.com; "${value}" is not one.`,
  );
}

function checkDomain(value: string): void {
  if (DOMAIN.test(value)) return;
  throw usageError(
    ADDRESS.test(value)
      ? `--${SCOPE_DOMAIN_FLAG} takes domains such as example.com; "${value}" is an inbox, so give it with --${SCOPE_ADDRESS_FLAG}.`
      : `--${SCOPE_DOMAIN_FLAG} takes domains such as example.com; "${value}" is not one.`,
  );
}

/**
 * scope_selection from --scope-address and --scope-domain, or nothing when
 * neither was given. `base` is the body --raw-body or --body-file gave.
 * Throws a usage error (exit 2) for a value that is not an inbox or a domain,
 * and when the request would not send evaluation_scope selected.
 */
export function scopeSelectionBodyFields(
  flags: Record<string, unknown>,
  base?: unknown,
): ExtensionBodyField[] {
  const addresses = scopeList(
    flags[SCOPE_ADDRESS_FLAG],
    SCOPE_ADDRESS_FLAG,
    checkAddress,
  );
  const domains = scopeList(
    flags[SCOPE_DOMAIN_FLAG],
    SCOPE_DOMAIN_FLAG,
    checkDomain,
  );
  if (!addresses && !domains) return [];
  const both = addresses !== undefined && domains !== undefined;
  const given = [
    ...(addresses ? [`--${SCOPE_ADDRESS_FLAG}`] : []),
    ...(domains ? [`--${SCOPE_DOMAIN_FLAG}`] : []),
  ].join(" and ");
  const goes = `${given} ${both ? "name" : "names"} what a selected scope covers, so ${both ? "they go" : "it goes"} with --evaluation-scope selected`;
  const fields: ExtensionBodyField[] = [
    {
      flag: given,
      property: "scope_selection",
      value: { addresses: addresses ?? [], domains: domains ?? [] },
    },
  ];
  // A --raw-body or --body-file that is not a JSON object cannot take these
  // fields at all; the command refuses it with that reason once merging.
  const baseIsObject =
    base !== null && typeof base === "object" && !Array.isArray(base);
  if (base !== undefined && !baseIsObject) return fields;
  // The scope the request sends: --evaluation-scope wins over the body's own,
  // as the body is merged.
  const scope =
    flags["evaluation-scope"] ??
    (baseIsObject
      ? (base as Record<string, unknown>).evaluation_scope
      : undefined);
  if (scope === undefined)
    throw usageError(
      `${goes}. Pass --evaluation-scope selected with ${both ? "them" : "it"}.`,
    );
  if (scope !== "selected")
    throw usageError(
      `${goes}, not ${typeof scope === "string" ? scope : JSON.stringify(scope)}. Pass --evaluation-scope selected, or leave ${both ? "them" : "it"} out.`,
    );
  return fields;
}
