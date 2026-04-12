import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const schemaPath = resolve(
  scriptDir,
  "../../json-schema/email-received-event.schema.json",
);
const outputDir = resolve(scriptDir, "../src/generated");
const outputPath = resolve(
  outputDir,
  "email-received-event.validator.generated.ts",
);
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

mkdirSync(outputDir, { recursive: true });

const ajv = new Ajv({
  allErrors: true,
  code: {
    esm: true,
    source: true,
  },
  strict: false,
});

addFormats(ajv);

const validate = ajv.compile(schema);
const moduleCode = standaloneCode(ajv, validate);

writeFileSync(
  outputPath,
  `// @ts-nocheck\n/**\n * AUTO-GENERATED - DO NOT EDIT\n * Run \`pnpm generate:validator\` to regenerate.\n */\n\n${moduleCode}\n`,
);
