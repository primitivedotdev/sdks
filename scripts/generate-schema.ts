/**
 * Generates JSON Schema from EmailReceivedEvent TypeScript type.
 * Run with: pnpm generate:schema
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGenerator } from "ts-json-schema-generator";

const config = {
  path: resolve(import.meta.dirname, "../src/types.ts"),
  tsconfig: resolve(import.meta.dirname, "../tsconfig.json"),
  type: "EmailReceivedEvent",
};

const generator = createGenerator(config);
const schema = generator.createSchema(config.type);

const output = `/**
 * JSON Schema for EmailReceivedEvent.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run \`pnpm generate:schema\` to regenerate.
 */

import type { JSONSchema7 } from "json-schema";

export const emailReceivedEventJsonSchema = ${JSON.stringify(schema, null, 2)} as const satisfies JSONSchema7;
`;

const outputPath = resolve(import.meta.dirname, "../src/schema.generated.ts");
writeFileSync(outputPath, output);

console.log(`Generated schema at ${outputPath}`);
