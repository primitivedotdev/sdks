// --scope-address and --scope-domain: a selected scope's inboxes and domains,
// on the email-rules commands whose request takes evaluation_scope. They set
// scope_selection, an object the generated per-field flags cannot express:
//
//   primitive email-rules create ... \
//     --scope-address support@example.com --scope-domain example.org
//
// They set scope_selection as a whole, over any in --raw-body or --body-file,
// like the other flags that set a body field. When only one of the two flags
// is given, the other list is sent empty. scope_selection goes with
// evaluation_scope selected, so they also send that when neither
// --scope nor the body gives a scope. A scope given otherwise is
// sent as it is, for the API to judge.
//
// This module does not import api-command.ts.

import { Errors, Flags } from "@oclif/core";
import type { ExtensionBodyField } from "./operation-extension.js";

export const SCOPE_ADDRESS_FLAG = "scope-address";
export const SCOPE_DOMAIN_FLAG = "scope-domain";

const SCOPE_FLAG_NOTE = `Sends evaluation_scope selected unless --scope or the body gives a scope. --${SCOPE_ADDRESS_FLAG} and --${SCOPE_DOMAIN_FLAG} set scope_selection as a whole, over any in --raw-body or --body-file, and a list not given is sent empty.`;

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
function scopeList(values: unknown, flag: string): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const list: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const raw of String(value).split(",")) {
      const item = raw.trim();
      if (item === "") continue;
      if (seen.has(item.toLowerCase())) continue;
      seen.add(item.toLowerCase());
      list.push(item);
    }
  }
  if (list.length === 0) throw usageError(`--${flag} needs a value.`);
  return list;
}

/**
 * scope_selection from --scope-address and --scope-domain, or nothing when
 * neither was given, with evaluation_scope selected when neither
 * --scope nor `base` (the body --raw-body or --body-file gave)
 * gives a scope.
 */
export function scopeSelectionBodyFields(
  flags: Record<string, unknown>,
  base?: unknown,
): ExtensionBodyField[] {
  const addresses = scopeList(flags[SCOPE_ADDRESS_FLAG], SCOPE_ADDRESS_FLAG);
  const domains = scopeList(flags[SCOPE_DOMAIN_FLAG], SCOPE_DOMAIN_FLAG);
  if (!addresses && !domains) return [];
  const given = [
    ...(addresses ? [`--${SCOPE_ADDRESS_FLAG}`] : []),
    ...(domains ? [`--${SCOPE_DOMAIN_FLAG}`] : []),
  ].join(" and ");
  const fields: ExtensionBodyField[] = [
    {
      flag: given,
      property: "scope_selection",
      value: { addresses: addresses ?? [], domains: domains ?? [] },
    },
  ];
  const baseScope =
    base !== null && typeof base === "object" && !Array.isArray(base)
      ? (base as Record<string, unknown>).evaluation_scope
      : undefined;
  if (flags.scope === undefined && baseScope === undefined)
    fields.push({
      flag: given,
      property: "evaluation_scope",
      value: "selected",
    });
  return fields;
}
