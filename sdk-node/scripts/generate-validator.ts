import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone";
import { fileURLToPath } from "node:url";
import { addValidatorFormats, VALIDATOR_AJV_OPTIONS } from "./validator-ajv.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const outputDir = resolve(scriptDir, "../src/generated");

interface ValidatorTarget {
  schemaFile: string;
  outputFile: string;
  // Named exports, each validating one definition of the schema. When set,
  // the module exports these validators by name instead of a single default
  // export for the whole schema. `validate` names the root.
  namedDefinitions?: Record<string, string>;
}

const targets: ValidatorTarget[] = [
  {
    schemaFile: "email-received-event.schema.json",
    outputFile: "email-received-event.validator.generated.ts",
  },
  {
    schemaFile: "sent-email-event.schema.json",
    outputFile: "sent-email-event.validator.generated.ts",
    // One validator per event shape, so a malformed body is reported against
    // the shape its event, scope and reason select rather than against every
    // branch of the oneOf at once.
    namedDefinitions: {
      validate: "",
      validateAccepted: "SentEmailAcceptedEvent",
      validateRecipientResult: "SentEmailRecipientResultEvent",
      validateRollupResult: "SentEmailRollupResultEvent",
      validateLegacyMessageResult: "SentEmailLegacyMessageResultEvent",
      validateCompleted: "SentEmailCompletedEvent",
    },
  },
];

mkdirSync(outputDir, { recursive: true });

for (const target of targets) {
  const schema = JSON.parse(
    readFileSync(
      resolve(scriptDir, "../../json-schema", target.schemaFile),
      "utf8",
    ),
  );

  const ajv = addValidatorFormats(
    new Ajv({
      ...VALIDATOR_AJV_OPTIONS,
      code: {
        esm: true,
        source: true,
      },
    }),
  );

  let moduleCode: string;
  if (target.namedDefinitions) {
    const schemaId = target.schemaFile;
    ajv.addSchema(schema, schemaId);
    const refs: Record<string, string> = {};
    for (const [exportName, definition] of Object.entries(
      target.namedDefinitions,
    )) {
      refs[exportName] = definition
        ? `${schemaId}#/definitions/${definition}`
        : schemaId;
    }
    moduleCode = standaloneCode(ajv, refs);
  } else {
    const validate = ajv.compile(schema);
    moduleCode = standaloneCode(ajv, validate);
  }

  writeFileSync(
    resolve(outputDir, target.outputFile),
    `// @ts-nocheck\n/**\n * AUTO-GENERATED - DO NOT EDIT\n * Run \`pnpm generate:validator\` to regenerate.\n */\n\n${moduleCode}\n`,
  );
}
