import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Args, Command, Errors, Flags } from "@oclif/core";

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

// The SDK version range that ships in the scaffolded package.json's
// dependencies. Pinned to the current shipped minor with a caret so
// patch releases of the SDK pick up automatically. Update alongside
// any minor or major version bump of the SDK; keep in lockstep with
// the CLI's own @primitivedotdev/sdk dep range in cli-node/package.json
// so scaffolded projects use the same SDK version the CLI was built
// and tested against.
const SDK_VERSION_RANGE = "^0.23.0";

// esbuild version range. Pinned to the latest stable major used
// elsewhere in the Primitive codebase for bundling Workers-style
// handlers. Caret range so patch fixes flow in automatically.
const ESBUILD_VERSION_RANGE = "^0.27.0";

// Validate a directory name passed as the positional argument.
// Matches a conservative slug shape: lowercase letters, digits,
// hyphens, underscores. Rejecting weirder names up front prevents
// surprises when the same string lands in package.json's `name`
// field (which has its own validation rules) or in shell scripts.
const VALID_NAME = /^[a-z0-9][a-z0-9_-]{0,62}$/;

export function isValidFunctionName(name: string): boolean {
  return VALID_NAME.test(name);
}

// File contents for the scaffolded project. Each renderer takes the
// function name and returns the raw file body. Kept as named exports
// so the unit test can assert content without having to spin up the
// oclif command lifecycle.

export function renderHandler(): string {
  return `// env.PRIMITIVE_API_KEY is auto-injected by the Primitive Functions runtime.
import { createPrimitiveClient } from "@primitivedotdev/sdk/api";

export default {
  async fetch(
    req: Request,
    env: { PRIMITIVE_API_KEY: string },
  ): Promise<Response> {
    const event = (await req.json()) as {
      email: { headers: { from?: string; subject?: string } };
    };
    const client = createPrimitiveClient({ apiKey: env.PRIMITIVE_API_KEY });

    const reply = await client.send({
      from: "you@your-domain.primitive.email",
      to: event.email.headers.from ?? "you@your-domain.primitive.email",
      subject: \`Re: \${event.email.headers.subject ?? ""}\`,
      bodyText: "Got your message.",
    });

    return Response.json({ ok: true, reply });
  },
};
`;
}

export function renderPackageJson(name: string): string {
  const pkg = {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      build: "node build.mjs",
      deploy: `npm run build && primitive functions:deploy --name ${name} --file ./dist/handler.js`,
      redeploy:
        "npm run build && primitive functions:redeploy --id $PRIMITIVE_FUNCTION_ID --file ./dist/handler.js",
    },
    dependencies: {
      "@primitivedotdev/sdk": SDK_VERSION_RANGE,
    },
    devDependencies: {
      esbuild: ESBUILD_VERSION_RANGE,
      typescript: "^5.7.2",
    },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export function renderBuildMjs(): string {
  return `import { build } from "esbuild";

// Bundle handler.ts into a single ESM file suitable for the Primitive
// Functions runtime. The runtime is a Workers-style environment, so
// we pick the "worker" / "browser" export conditions on @primitivedotdev/sdk
// (which routes us to the /api subpath safely without dragging in
// node:crypto-dependent webhook helpers).

await build({
  entryPoints: ["handler.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["worker", "browser"],
  outfile: "dist/handler.js",
});
`;
}

export function renderTsconfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      lib: ["ES2022", "WebWorker"],
      types: [],
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ["handler.ts"],
  };
  return `${JSON.stringify(tsconfig, null, 2)}\n`;
}

export function renderGitignore(): string {
  return "node_modules\ndist\n";
}

export function renderReadme(name: string): string {
  return `# ${name}

## What this is

A Primitive Function: a JavaScript handler that runs on inbound mail.
It receives the \`email.received\` event, demonstrates a basic reply
via the Primitive SDK, and returns a JSON envelope.

## Develop

\`\`\`
npm install
npm run build
\`\`\`

## Deploy

\`\`\`
npm run deploy
\`\`\`

The deploy step calls \`primitive functions:deploy\` (provided by the
\`@primitivedotdev/cli\` package; install with
\`npm install -g @primitivedotdev/cli\` or run via
\`npx @primitivedotdev/cli@latest <command>\`). It requires
\`PRIMITIVE_API_KEY\` to be set in your shell (or pass \`--api-key\`).
Run \`primitive login\` once to save a key in your CLI config if you
prefer that to an env var.
`;
}

// Files written by the scaffolder, in the order they're created.
// Exported as a pure function so the unit test can verify the
// exact content of every file without invoking the command and
// touching disk.
export function scaffoldFiles(
  name: string,
): { relativePath: string; contents: string }[] {
  return [
    { contents: renderHandler(), relativePath: "handler.ts" },
    { contents: renderPackageJson(name), relativePath: "package.json" },
    { contents: renderBuildMjs(), relativePath: "build.mjs" },
    { contents: renderTsconfig(), relativePath: "tsconfig.json" },
    { contents: renderGitignore(), relativePath: ".gitignore" },
    { contents: renderReadme(name), relativePath: "README.md" },
  ];
}

// Write the scaffold to disk. Refuses to overwrite an existing
// directory: if `outDir` exists the function throws and leaves the
// filesystem untouched. On any write error after creating the
// directory, the partially-written tree is cleaned up so re-runs
// see a clean slate. Exported for unit testing.
export function writeScaffold(params: { name: string; outDir: string }): {
  written: string[];
} {
  if (!isValidFunctionName(params.name)) {
    throw new Errors.CLIError(
      `Invalid function name "${params.name}". Use lowercase letters, digits, hyphens, or underscores (1-63 chars, must start with a letter or digit).`,
      { exit: 1 },
    );
  }

  const files = scaffoldFiles(params.name);
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
    `Scaffold a new Primitive Function project in ./<name>/ with handler.ts, package.json, build.mjs, tsconfig.json, .gitignore, and README.md.

  The scaffolded handler imports \`createPrimitiveClient\` from
  \`@primitivedotdev/sdk/api\` and demonstrates the canonical pattern:
  parse the email.received event, send a reply via the SDK, return a
  JSON envelope. The build script uses esbuild's JS API and emits
  ./dist/handler.js, ready to hand to \`primitive functions:deploy --file\`.

  Refuses to overwrite an existing directory. Use --out-dir to pick a
  different target path than ./<name>/.`;

  static summary =
    "Scaffold a new Primitive Function project ready for functions:deploy";

  static examples = [
    "<%= config.bin %> functions:init my-fn",
    "<%= config.bin %> functions:init my-fn --out-dir ./functions/my-fn",
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
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(FunctionsInitCommand);

    const outDir = resolve(flags["out-dir"] ?? `./${args.name}`);

    writeScaffold({ name: args.name, outDir });

    this.log(`Scaffolded ${outDir}.`);
    this.log("Next:");
    this.log(`  cd ${outDir}`);
    this.log("  npm install");
    this.log("  npm run build");
    this.log(
      `  primitive functions:deploy --name ${args.name} --file ./dist/handler.js`,
    );
  }
}

export default FunctionsInitCommand;
