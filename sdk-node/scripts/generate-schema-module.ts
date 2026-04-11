import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const schemaPath = resolve(
  scriptDir,
  "../../json-schema/email-received-event.schema.json",
);
const outputPath = resolve(scriptDir, "../src/schema.generated.ts");
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
