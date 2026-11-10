import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import {
  addValidatorFormats,
  VALIDATOR_AJV_OPTIONS,
} from "../../scripts/validator-ajv.js";

// The Python SDK checks date-time and uri with the same patterns and runs the
// same cases, so a change to a pattern here shows up in both suites.

const __dirname = dirname(fileURLToPath(import.meta.url));

type FormatCase = { value: string; valid: boolean };

const fixture = JSON.parse(
  readFileSync(
    join(__dirname, "../../../test-fixtures/formats/cases.json"),
    "utf8",
  ),
) as { "date-time": FormatCase[]; uri: FormatCase[] };

const ajv = addValidatorFormats(new Ajv(VALIDATOR_AJV_OPTIONS));

describe.each(["date-time", "uri"] as const)(
  "the %s format of the generated validators",
  (format) => {
    const check = ajv.compile({ type: "string", format });

    it.each(
      fixture[format].map((testCase): [string, boolean] => [
        JSON.stringify(testCase.value),
        testCase.valid,
      ]),
    )("gives %s the shared verdict", (value, valid) => {
      expect(check(JSON.parse(value))).toBe(valid);
    });
  },
);
