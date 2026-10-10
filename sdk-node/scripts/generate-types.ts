import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { compile } from "json-schema-to-typescript";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

interface TypesTarget {
  schemaFile: string;
  rootDefinition: string;
  outputPath: string;
  banner: string;
}

const targets: TypesTarget[] = [
  {
    schemaFile: "email-received-event.schema.json",
    rootDefinition: "EmailReceivedEvent",
    outputPath: "../src/types.generated.ts",
    banner: "Types for Primitive webhook payloads.",
  },
  {
    schemaFile: "sent-email-event.schema.json",
    rootDefinition: "SentEmailEvent",
    outputPath: "../src/generated/sent-email-event.types.generated.ts",
    banner: "Types for Primitive sent_email.* webhook payloads.",
  },
];

for (const target of targets) {
  const schemaPath = resolve(scriptDir, "../../json-schema", target.schemaFile);
  const outputPath = resolve(scriptDir, target.outputPath);

  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
    $schema: string;
    definitions: Record<string, unknown>;
  };

  const rootDefinition = schema.definitions[target.rootDefinition];

  if (
    !rootDefinition ||
    typeof rootDefinition !== "object" ||
    Array.isArray(rootDefinition)
  ) {
    throw new Error(
      `Expected schema.definitions.${target.rootDefinition} to be an object`,
    );
  }

  const rootSchema = {
    ...rootDefinition,
    $schema: schema.$schema,
    definitions: schema.definitions,
  };

  const output = await compile(rootSchema, target.rootDefinition, {
    additionalProperties: false,
    bannerComment: `/**
 * ${target.banner}
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run \`pnpm generate:types\` to regenerate.
 */`,
    declareExternallyReferenced: true,
    format: false,
    unreachableDefinitions: true,
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output.replace(/[ \t]+$/gm, ""));
}
