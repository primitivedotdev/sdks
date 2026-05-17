import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Args, Command, Errors, Flags } from "@oclif/core";
import {
  DEFAULT_FUNCTION_TEMPLATE_ID,
  FUNCTION_TEMPLATES,
  type FunctionTemplateFile,
  findFunctionTemplate,
  functionTemplateIds,
} from "../function-templates.js";

export {
  FUNCTION_TEMPLATES,
  renderBuildMjs,
  renderGitignore,
  renderHandler,
  renderPackageJson,
  renderReadme,
  renderTsconfig,
} from "../function-templates.js";

// `primitive functions:init <name>` stamps a deployable Function project
// into ./<name>/ so a new author can go from zero to a deployed handler
// in two commands: `npm install && npm run build` then
// `primitive functions:deploy --name <name> --file ./dist/handler.js`.
//
// The scaffolded handler imports `createPrimitiveClient` from
// `@primitivedotdev/sdk/api`, NOT from the package root. The root export
// pulls in webhook helpers that depend on `node:crypto`, which breaks
// Workers-style bundles. The `/api` subpath is the runtime-client
// surface and is the documented import for in-handler use.

// Validate a directory name passed as the positional argument.
// Matches a conservative slug shape: lowercase letters, digits,
// hyphens, underscores. Rejecting weirder names up front prevents
// surprises when the same string lands in package.json's `name`
// field (which has its own validation rules) or in shell scripts.
const VALID_NAME = /^[a-z0-9][a-z0-9_-]{0,62}$/;

export function isValidFunctionName(name: string): boolean {
  return VALID_NAME.test(name);
}

function unknownTemplateError(templateId: string): Errors.CLIError {
  const available = functionTemplateIds(FUNCTION_TEMPLATES).join(", ");
  return new Errors.CLIError(
    `Unknown function template "${templateId}". Available templates: ${available}. Run \`primitive functions templates\` for details.`,
    { exit: 1 },
  );
}

// Files written by the scaffolder, in the order they're created.
// Exported as a pure function so the unit test can verify the
// exact content of every file without invoking the command and
// touching disk.
export function scaffoldFiles(
  name: string,
  templateId = DEFAULT_FUNCTION_TEMPLATE_ID,
): FunctionTemplateFile[] {
  const template = findFunctionTemplate(FUNCTION_TEMPLATES, templateId);
  if (!template) throw unknownTemplateError(templateId);
  return template.files({ name });
}

// Write the scaffold to disk. Refuses to overwrite an existing
// directory: if `outDir` exists the function throws and leaves the
// filesystem untouched. On any write error after creating the
// directory, the partially-written tree is cleaned up so re-runs
// see a clean slate. Exported for unit testing.
export function writeScaffold(params: {
  name: string;
  outDir: string;
  templateId?: string;
}): {
  written: string[];
} {
  if (!isValidFunctionName(params.name)) {
    throw new Errors.CLIError(
      `Invalid function name "${params.name}". Use lowercase letters, digits, hyphens, or underscores (1-63 chars, must start with a letter or digit).`,
      { exit: 1 },
    );
  }

  const templateId = params.templateId ?? DEFAULT_FUNCTION_TEMPLATE_ID;
  const files = scaffoldFiles(params.name, templateId);
  const written: string[] = [];

  // Create the target directory with recursive: false so the check
  // and the create happen in one syscall. mkdirSync throws EEXIST
  // atomically if the path already exists, which closes the TOCTOU
  // window between a separate existsSync check and the mkdir call.
  try {
    mkdirSync(params.outDir, { recursive: false });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      throw new Errors.CLIError(
        `Target directory already exists: ${params.outDir}. Refusing to overwrite. Remove it or pick a different --out-dir.`,
        { exit: 1 },
      );
    }
    if (code === "ENOENT") {
      throw new Errors.CLIError(
        `Parent directory does not exist for ${params.outDir}. Create it first or pick a different --out-dir.`,
        { exit: 1 },
      );
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Errors.CLIError(`Failed to create ${params.outDir}: ${detail}`, {
      exit: 1,
    });
  }

  try {
    for (const file of files) {
      const fullPath = resolve(params.outDir, file.relativePath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.contents, "utf8");
      written.push(fullPath);
    }
  } catch (error) {
    // Roll back the partial scaffold so the user can retry without
    // tripping the "directory already exists" guard above.
    try {
      rmSync(params.outDir, { force: true, recursive: true });
    } catch {
      // Best-effort cleanup; surface the original error regardless.
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Errors.CLIError(
      `Failed to write scaffold to ${params.outDir}: ${detail}`,
      { exit: 1 },
    );
  }

  return { written };
}

class FunctionsInitCommand extends Command {
  static description =
    `Scaffold a new Primitive Function project from a Primitive-owned template.

  The scaffolded handler imports \`createPrimitiveClient\` from
  \`@primitivedotdev/sdk/api\` and demonstrates the canonical pattern:
  parse the email.received event, send a reply via the SDK, return a
  JSON envelope. The build script uses esbuild's JS API and emits
  ./dist/handler.js, ready to hand to \`primitive functions deploy --file\`.

  Refuses to overwrite an existing directory. Use --out-dir to pick a
  different target path than ./<name>/. Run \`primitive functions templates\`
  to inspect available templates.`;

  static summary =
    "Scaffold a new Primitive Function project ready for functions deploy";

  static examples = [
    "<%= config.bin %> functions init my-fn",
    "<%= config.bin %> functions init my-fn --template email-reply",
    "<%= config.bin %> functions init my-fn --out-dir ./functions/my-fn",
  ];

  static args = {
    name: Args.string({
      description:
        "Function name. Lowercase letters, digits, hyphens, underscores. 1-63 chars. Used as the directory name (when --out-dir is not set) and as the package.json name.",
      required: true,
    }),
  };

  static flags = {
    "out-dir": Flags.string({
      description:
        "Directory to scaffold into. Defaults to ./<name>/. Must not already exist.",
    }),
    template: Flags.string({
      default: DEFAULT_FUNCTION_TEMPLATE_ID,
      description:
        "Function template id. Run `primitive functions templates` to list templates.",
      options: functionTemplateIds(FUNCTION_TEMPLATES),
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(FunctionsInitCommand);

    const outDir = resolve(flags["out-dir"] ?? `./${args.name}`);

    writeScaffold({ name: args.name, outDir, templateId: flags.template });

    this.log(`Scaffolded ${outDir} from ${flags.template} template.`);
    this.log("Next:");
    this.log(`  cd ${outDir}`);
    this.log("  npm install");
    this.log("  npm run build");
    this.log(
      `  primitive functions deploy --name ${args.name} --file ./dist/handler.js`,
    );
  }
}

export default FunctionsInitCommand;
