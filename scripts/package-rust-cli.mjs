#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { arch, platform } from "node:process";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const SUPPORTED_TARGETS = new Set([
  "linux-x64",
  "linux-arm64",
  "macos-x64",
  "macos-arm64",
  "windows-x64",
]);

function parseArgs(argv) {
  const args = { json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const name = arg.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;
    args[name] = value;
  }

  return args;
}

function normalizeTarget() {
  const osName =
    platform === "darwin" ? "macos" : platform === "win32" ? "windows" : platform;
  const archName = arch === "x64" ? "x64" : arch === "arm64" ? "arm64" : arch;

  return `${osName}-${archName}`;
}

function defaultArchiveFormat(target) {
  return target.startsWith("windows-") ? "zip" : "tar.gz";
}

function defaultBinaryExtension(target) {
  return target.startsWith("windows-") ? ".exe" : "";
}

function validateArchiveFormat(format) {
  if (format !== "tar.gz" && format !== "zip") {
    throw new Error(`Unsupported archive format: ${format}`);
  }
}

function validateTarget(target) {
  if (!SUPPORTED_TARGETS.has(target)) {
    throw new Error(`Unsupported target: ${target}`);
  }
}

function validateVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(
      `Unsupported Rust CLI archive version: ${version}. Use semver without build metadata.`,
    );
  }
}

function validateTargetShape(target, archiveFormat, binExt) {
  const expectedArchiveFormat = defaultArchiveFormat(target);
  if (archiveFormat !== expectedArchiveFormat) {
    throw new Error(
      `Target ${target} must use ${expectedArchiveFormat} archives, got ${archiveFormat}`,
    );
  }

  const expectedBinExt = defaultBinaryExtension(target);
  if (binExt !== expectedBinExt) {
    const renderedExpected = expectedBinExt || "no extension";
    const renderedActual = binExt || "no extension";
    throw new Error(
      `Target ${target} must use ${renderedExpected} binaries, got ${renderedActual}`,
    );
  }
}

async function readCargoVersion() {
  const cargoToml = await readFile(path.join(repoRoot, "cli-rust/Cargo.toml"), "utf8");
  const packageSection = cargoToml
    .split(/\n(?=\[)/u)
    .find((section) => section.trimStart().startsWith("[package]"));
  const match = packageSection?.match(/^version\s*=\s*"([^"]+)"\s*$/mu);

  if (!match) {
    throw new Error("Could not read cli-rust package version");
  }

  return match[1];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
  }
}

async function sha256(filePath) {
  const hash = createHash("sha256");

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });

  return hash.digest("hex");
}

function buildArchiveReadme({ primName, primitiveName, target, version }) {
  const runPrefix = target.startsWith("windows-") ? ".\\" : "./";

  return `# Primitive Rust CLI

This archive contains Primitive CLI release binaries for ${target}, version ${version}.

Files:
- ${primitiveName}: primary CLI command
- ${primName}: short CLI alias
- LICENSE: license terms
- README.md: this install note

Install:
- Move ${primitiveName} and ${primName} to a directory on your PATH.
- On macOS or Linux, make them executable if needed: chmod +x ${primitiveName} ${primName}
- Run ${runPrefix}${primitiveName} --version or ${runPrefix}${primName} --version.

Scripted installers are available in the Primitive SDKs repository:
- scripts/install-rust-cli.sh for macOS and Linux
- scripts/install-rust-cli.ps1 for Windows
`;
}

function writeTarGzArchive(stageDir, archivePath, members) {
  run("tar", ["-C", stageDir, "-czf", archivePath, ...members]);
}

function writeZipArchive(stageDir, archivePath, members) {
  if (platform === "win32") {
    const literalPaths = members.join(";");
    run("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$paths = $env:PRIMITIVE_ZIP_PATHS -split ';'; " +
        "Compress-Archive -LiteralPath $paths -DestinationPath $env:PRIMITIVE_ZIP_ARCHIVE -Force",
    ], {
      cwd: stageDir,
      env: {
        PRIMITIVE_ZIP_ARCHIVE: archivePath,
        PRIMITIVE_ZIP_PATHS: literalPaths,
      },
    });
    return;
  }

  run("zip", ["-q", "-j", archivePath, ...members.map((member) => path.join(stageDir, member))]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = args.version || (await readCargoVersion());
  const target = args.target || normalizeTarget();
  const archiveFormat = args["archive-format"] || defaultArchiveFormat(target);
  const binExt = args["bin-ext"] ?? defaultBinaryExtension(target);
  validateVersion(version);
  validateTarget(target);
  validateArchiveFormat(archiveFormat);
  validateTargetShape(target, archiveFormat, binExt);
  const binDir = path.resolve(
    repoRoot,
    args["bin-dir"] || "cli-rust/target/release",
  );
  const primitiveSource = path.resolve(
    repoRoot,
    args["primitive-bin"] || path.join(binDir, `primitive${binExt}`),
  );
  const primSource = path.resolve(
    repoRoot,
    args["prim-bin"] || path.join(binDir, `prim${binExt}`),
  );
  const outDir = path.resolve(repoRoot, args["out-dir"] || "cli-rust/dist");
  const archiveName = `primitive-rust-cli-v${version}-${target}.${archiveFormat}`;
  const archivePath = path.join(outDir, archiveName);
  const checksumPath = `${archivePath}.sha256`;
  const stageDir = await mkdtemp(path.join(tmpdir(), "primitive-rust-cli-"));

  try {
    await mkdir(outDir, { recursive: true });
    await rm(archivePath, { force: true });
    await rm(checksumPath, { force: true });

    const primitiveName = `primitive${binExt}`;
    const primName = `prim${binExt}`;
    const primitivePath = path.join(stageDir, primitiveName);
    const primPath = path.join(stageDir, primName);
    const readmeName = "README.md";
    const licenseName = "LICENSE";
    await copyFile(primitiveSource, primitivePath);
    await chmod(primitivePath, 0o755);
    await copyFile(primSource, primPath);
    await chmod(primPath, 0o755);
    await writeFile(
      path.join(stageDir, readmeName),
      buildArchiveReadme({ primName, primitiveName, target, version }),
    );
    await copyFile(path.join(repoRoot, "LICENSE"), path.join(stageDir, licenseName));

    const archiveMembers = [primitiveName, primName, readmeName, licenseName];

    if (archiveFormat === "zip") {
      writeZipArchive(stageDir, archivePath, archiveMembers);
    } else {
      writeTarGzArchive(stageDir, archivePath, archiveMembers);
    }

    const checksum = await sha256(archivePath);
    await writeFile(checksumPath, `${checksum}  ${archiveName}\n`);

    const output = {
      archive: archivePath,
      archiveFormat,
      binaryExtension: binExt,
      checksum: checksumPath,
      target,
      version,
    };

    if (process.env.GITHUB_OUTPUT) {
      await writeFile(
        process.env.GITHUB_OUTPUT,
        `archive=${archivePath}\narchive_format=${archiveFormat}\nbinary_extension=${binExt}\nchecksum=${checksumPath}\ntarget=${target}\nversion=${version}\n`,
        { flag: "a" },
      );
    }

    if (args.json) {
      process.stdout.write(`${JSON.stringify(output)}\n`);
      return;
    }

    process.stdout.write(`Wrote ${archivePath}\n`);
    process.stdout.write(`Wrote ${checksumPath}\n`);
  } finally {
    await rm(stageDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
