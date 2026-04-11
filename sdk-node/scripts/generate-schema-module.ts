import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const schemaPath = resolve(
  import.meta.dirname,
  "../../json-schema/email-received-event.schema.json",
);
const outputPath = resolve(import.meta.dirname, "../src/schema.generated.ts");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const output = `/**
 * JSON Schema for EmailReceivedEvent.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run \`pnpm generate:schema\` to regenerate.
 */

import type { JSONSchema7 } from "json-schema";

export const emailReceivedEventJsonSchema = ${JSON.stringify(schema, null, 2)} as const satisfies JSONSchema7;
`;

writeFileSync(outputPath, output);
