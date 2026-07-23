#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { platform } from "node:process";

function parseArgs(argv) {
  const args = {
    bin: "",
    expectStatic: false,
    json: false,
    maxGlibc: process.env.RUST_CLI_MAX_GLIBC || "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--expect-static") {
      args.expectStatic = true;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--bin" || arg === "--max-glibc") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      if (arg === "--bin") {
        args.bin = value;
      } else {
        args.maxGlibc = value;
      }
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!args.bin) {
    throw new Error("--bin is required");
  }
  if (args.maxGlibc && !/^\d+\.\d+$/u.test(args.maxGlibc)) {
    throw new Error(`Invalid --max-glibc value: ${args.maxGlibc}`);
  }

  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error?.code === "ENOENT" && options.optional) {
    return null;
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (options.allowFailure) {
      return result.stdout || result.stderr;
    }
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
  }

  return result.stdout;
}

function parseVersion(version) {
  const [major, minor] = version.split(".").map((part) => Number.parseInt(part, 10));
  return { major, minor };
}

function compareVersions(left, right) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (leftVersion.major !== rightVersion.major) {
    return leftVersion.major - rightVersion.major;
  }
  return leftVersion.minor - rightVersion.minor;
}

function extractGlibcVersions(output) {
  const versions = new Set();
  const pattern = /GLIBC_(\d+\.\d+)/gu;
  let match = pattern.exec(output);
  while (match) {
    versions.add(match[1]);
    match = pattern.exec(output);
  }
  return [...versions].sort(compareVersions);
}

function inspectElf(bin) {
  const output = run("readelf", ["-l", bin]);
  return {
    hasProgramInterpreter: /INTERP/u.test(output),
  };
}

function inspectNativeDeps(bin) {
  const output = run("ldd", [bin], { allowFailure: true, optional: true });
  if (output === null) {
    throw new Error("missing ldd for Linux native dependency inspection");
  }

  const forbidden = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /(?:^|\s)lib(?:ssl|crypto|z)\.so(?:\.|\s|$)/u.test(line));

  if (forbidden.length > 0) {
    throw new Error(
      `Rust CLI archive unexpectedly links OpenSSL/libz:\n${forbidden.join("\n")}`,
    );
  }

  const missing = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.includes("not found"));

  if (missing.length > 0) {
    throw new Error(`Rust CLI binary has missing native dependencies:\n${missing.join("\n")}`);
  }

  return output;
}

function inspectGlibcVersions(bin) {
  const objdumpOutput = run("objdump", ["-T", bin], { allowFailure: true, optional: true });
  if (objdumpOutput !== null) {
    const versions = extractGlibcVersions(objdumpOutput);
    if (versions.length > 0 || !/not a dynamic object/iu.test(objdumpOutput)) {
      return {
        source: "objdump",
        versions,
      };
    }
  }

  const readelfOutput = run("readelf", ["--version-info", bin], {
    allowFailure: true,
    optional: true,
  });
  if (readelfOutput !== null) {
    return {
      source: "readelf",
      versions: extractGlibcVersions(readelfOutput),
    };
  }

  throw new Error("missing objdump or readelf for GLIBC symbol inspection");
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (platform !== "linux") {
    const result = { skipped: true, reason: `platform is ${platform}` };
    process.stdout.write(
      args.json ? `${JSON.stringify(result)}\n` : "Skipped non-Linux portability check\n",
    );
    return;
  }

  const elf = inspectElf(args.bin);
  if (args.expectStatic && elf.hasProgramInterpreter) {
    throw new Error("Rust CLI Linux release binary must be statically linked");
  }

  if (elf.hasProgramInterpreter) {
    inspectNativeDeps(args.bin);
  }

  const glibc = inspectGlibcVersions(args.bin);
  const maxObserved = glibc.versions.at(-1) || null;

  if (args.expectStatic && maxObserved) {
    throw new Error(`Rust CLI static Linux binary unexpectedly references GLIBC_${maxObserved}`);
  }
  if (args.maxGlibc && maxObserved && compareVersions(maxObserved, args.maxGlibc) > 0) {
    throw new Error(
      `Rust CLI binary requires GLIBC_${maxObserved}, above allowed GLIBC_${args.maxGlibc}`,
    );
  }

  const result = {
    dynamic: elf.hasProgramInterpreter,
    maxAllowedGlibc: args.maxGlibc || null,
    maxObservedGlibc: maxObserved,
    source: glibc.source,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const linkage = elf.hasProgramInterpreter ? "dynamic" : "static";
  const observed = maxObserved ? `max GLIBC_${maxObserved}` : "no GLIBC symbols";
  process.stdout.write(`Linux portability check passed: ${linkage}, ${observed}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
