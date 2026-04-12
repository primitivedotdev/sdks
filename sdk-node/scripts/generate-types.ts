import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { compile } from "json-schema-to-typescript";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const schemaPath = resolve(
  scriptDir,
  "../../json-schema/email-received-event.schema.json",
);
const outputPath = resolve(scriptDir, "../src/types.generated.ts");

const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
  $schema: string;
  definitions: Record<string, unknown>;
};

const emailReceivedEventSchema = schema.definitions.EmailReceivedEvent;

if (
  !emailReceivedEventSchema ||
  typeof emailReceivedEventSchema !== "object" ||
  Array.isArray(emailReceivedEventSchema)
) {
  throw new Error(
    'Expected schema.definitions.EmailReceivedEvent to be an object',
  );
}

const rootSchema = {
  ...emailReceivedEventSchema,
  $schema: schema.$schema,
  definitions: schema.definitions,
};

const output = await compile(rootSchema, "EmailReceivedEvent", {
  additionalProperties: false,
  bannerComment: `/**
 * Types for Primitive webhook payloads.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run \`pnpm generate:types\` to regenerate.
 */`,
  declareExternallyReferenced: true,
  format: false,
  unreachableDefinitions: true,
});

writeFileSync(outputPath, output);
