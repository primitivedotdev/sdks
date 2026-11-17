import type { PrimitiveOperationManifest } from "@primitivedotdev/api-core";
import { missingBodyFields } from "./required-body-fields.js";

export const HELP_GROUPS = ["required", "command", "common"] as const;
export type HelpGroup = (typeof HELP_GROUPS)[number];
export const HELP_GROUP_HEADERS: Record<HelpGroup, string> = {
  required: "REQUIRED INPUTS",
  command: "COMMAND OPTIONS",
  common: "COMMON FLAGS",
};

/** Presentation metadata; it must never change the parser's required flags. */
export type HelpInputs = {
  requiredFlags: readonly string[];
  requiredJsonFields: readonly string[];
};

const COMMON_FLAGS = new Set([
  "api-key",
  "api-base-url",
  "json",
  "time",
  "raw-body",
  "envelope",
  "output",
  "idempotency-key",
  "step-up-token",
]);

export function helpFlagGroup(
  name: string,
  flag: { required?: boolean; exactlyOne?: readonly string[] },
  inputs: HelpInputs | undefined,
  flagNames: ReadonlySet<string>,
): HelpGroup {
  if (
    flag.required ||
    flag.exactlyOne?.length ||
    inputs?.requiredFlags.includes(name)
  )
    return "required";
  // A handwritten send's --body-file contains message text. Only the JSON
  // escape hatch, offered alongside --raw-body, is a common request flag.
  if (
    COMMON_FLAGS.has(name) ||
    (name === "body-file" && flagNames.has("raw-body"))
  )
    return "common";
  return "command";
}

export function operationHelpInputs(
  operation: Pick<PrimitiveOperationManifest, "requestSchema" | "bodyRequired">,
  bodyFlagToProperty: ReadonlyMap<string, string>,
  positionalFlag?: string,
): HelpInputs {
  const propertyFlags = new Map(
    [...bodyFlagToProperty].map(([flag, property]) => [property, `--${flag}`]),
  );
  const missing = operation.bodyRequired
    ? missingBodyFields(operation.requestSchema, {}, propertyFlags, true)
    : [];
  return {
    requiredFlags: [
      ...missing.flatMap((field) => (field.flag ? [field.flag.slice(2)] : [])),
      ...(positionalFlag ? [positionalFlag] : []),
    ],
    requiredJsonFields:
      operation.bodyRequired && missing.length === 0
        ? ["$"]
        : missing
            .filter((field) => field.flag === null)
            .map((field) => field.json_path),
  };
}
