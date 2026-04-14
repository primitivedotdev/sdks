import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Ajv from "ajv";
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

// RFC 3339 date-time pattern: YYYY-MM-DDThh:mm:ss[.frac](Z|+hh:mm|-hh:mm)
const DATE_TIME_RE =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])[T\t ](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/;

// RFC 3986 URI pattern (from ajv-formats)
const URI_RE =
  /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;

const ajv = new Ajv({
  allErrors: true,
  code: {
    esm: true,
    source: true,
  },
  strict: false,
});

// Register format validators as regex patterns instead of using ajv-formats.
// AJV inlines regex patterns directly into the generated code, avoiding CJS
// require() calls that cause "Can't resolve 'module'" errors in bundlers
// like Next.js Turbopack.
ajv.addFormat("date-time", DATE_TIME_RE);
ajv.addFormat("uri", URI_RE);

const validate = ajv.compile(schema);
const moduleCode = standaloneCode(ajv, validate);

writeFileSync(
  outputPath,
  `// @ts-nocheck\n/**\n * AUTO-GENERATED - DO NOT EDIT\n * Run \`pnpm generate:validator\` to regenerate.\n */\n\n${moduleCode}\n`,
);
