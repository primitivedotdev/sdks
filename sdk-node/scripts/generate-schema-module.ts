import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

interface SchemaModuleTarget {
  schemaFile: string;
  outputPath: string;
  title: string;
  exportName: string;
}

const targets: SchemaModuleTarget[] = [
  {
    schemaFile: "email-received-event.schema.json",
    outputPath: "../src/schema.generated.ts",
    title: "EmailReceivedEvent",
    exportName: "emailReceivedEventJsonSchema",
  },
  {
    schemaFile: "sent-email-event.schema.json",
    outputPath: "../src/generated/sent-email-event.schema.generated.ts",
    title: "SentEmailEvent",
    exportName: "sentEmailEventJsonSchema",
  },
];

for (const target of targets) {
  const schemaPath = resolve(scriptDir, "../../json-schema", target.schemaFile);
  const outputPath = resolve(scriptDir, target.outputPath);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

  const output = `/**
 * JSON Schema for ${target.title}.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run \`pnpm generate:schema\` to regenerate.
 */

import type { JSONSchema7 } from "json-schema";

export const ${target.exportName} = ${JSON.stringify(schema, null, 2)} as const satisfies JSONSchema7;
`;

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);
}
