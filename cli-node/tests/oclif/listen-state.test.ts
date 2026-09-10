import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  fstatSync,
  fsyncSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireListenLock,
  listenIdentity,
  listenProcessIdentity,
  normalizeListenOrigin,
  resolveListenSubscription,
} from "../../src/oclif/listen-state.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    fsyncSync: vi.fn(actual.fsyncSync),
    readFileSync: vi.fn(actual.readFileSync),
    unlinkSync: vi.fn(actual.unlinkSync),
  };
});
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});

const actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
const BOOT_ID = "0385d3d5-2a65-41bd-9596-c3dd32c06ddd";

function platform(value: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { configurable: true, value });
}

function linuxIdentity(started: () => string | null): void {
  platform("linux");
  vi.mocked(readFileSync).mockImplementation((file, options) => {
    if (file === "/proc/sys/kernel/random/boot_id") return `${BOOT_ID}\n`;
    if (String(file).startsWith("/proc/")) {
      const start = started();
      if (start === null) throw new Error("unavailable");
      const fields = Array<string>(20).fill("0");
      fields[0] = "S";
      fields[19] = start;
      // Exercise comm parsing: whitespace and closing parentheses are legal.
      return `${String(file).split("/")[2]} (node ) worker) ${fields.join(" ")}\n`;
    }
    return actualFs.readFileSync(file, options);
  });
}

function lockOwner(): { path: string; owner: string; file: string } {
  const name = readdirSync(directory).find((entry) => entry.endsWith(".lock"));
  if (!name) throw new Error("missing lock");
  const path = join(directory, name);
  const owner = readdirSync(path)[0];
  if (!owner) throw new Error("missing owner");
  return { path, owner, file: join(path, owner) };
}

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "primitive-listen-state-"));
});
afterEach(() => {
  if (platformDescriptor)
    Object.defineProperty(process, "platform", platformDescriptor);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.mocked(fsyncSync).mockRestore();
  vi.mocked(readFileSync).mockRestore();
  vi.mocked(unlinkSync).mockRestore();
  vi.mocked(execFileSync).mockRestore();
  rmSync(directory, { recursive: true, force: true });
});

describe("durable listener identity", () => {
  it("normalizes origin and isolates account identities without storing credentials", () => {
    expect(normalizeListenOrigin("HTTPS://API.EXAMPLE.TEST:443/v1/")).toBe(
      "https://api.example.test/v1",
    );
    expect(listenIdentity("https://api.example.test/v1/", "account-a")).toBe(
      listenIdentity("https://api.example.test/v1", "account-a"),
    );
    expect(listenIdentity("https://api.example.test/v1", "account-a")).not.toBe(
      listenIdentity("https://api.example.test/v1", "account-b"),
    );
    expect(() =>
      normalizeListenOrigin("https://secret@api.example.test/v1"),
    ).toThrow();
  });
  it("persists a private default name before registration and reuses it after reconnect", () => {
    const first = resolveListenSubscription(directory, "account-a");
    first.release();
    const second = resolveListenSubscription(directory, "account-a");
    expect(second.name).toBe(first.name);
    const file = join(directory, "listen", "account-a", "default.json");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      name: first.name,
    });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(join(directory, "listen", "account-a")).mode & 0o777).toBe(
      0o700,
    );
    second.release();
  });
  it("blocks concurrent ownership only for the same subscription", () => {
    const first = resolveListenSubscription(
      directory,
      "account-a",
      "assistant",
    );
    expect(() =>
      resolveListenSubscription(directory, "account-a", "assistant"),
    ).toThrow("Another listener");
    const other = resolveListenSubscription(directory, "account-a", "another");
    first.release();
    first.release();
    other.release();
    const resumed = resolveListenSubscription(
      directory,
      "account-a",
      "assistant",
    );
    resumed.release();
  });
  it("does not remove the next generation when an old release is repeated", () => {
    const old = acquireListenLock(directory, "queue");
    old();
    const next = acquireListenLock(directory, "queue");
    old();
    expect(() => acquireListenLock(directory, "queue")).toThrow(
      "Another listener",
    );
    next();
  });
  it("recovers a crashed owner atomically across competing real processes", async () => {
    const module = join(directory, "listen-state.mjs");
    writeFileSync(
      module,
      ts.transpileModule(
        readFileSync(resolve("src/oclif/listen-state.ts"), "utf8"),
        {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        },
      ).outputText,
    );
    const moduleUrl = pathToFileURL(module).href;
    const script = `import { acquireListenLock } from ${JSON.stringify(moduleUrl)}; acquireListenLock(process.argv[1], 'queue');`;
    execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      script,
      directory,
    ]);
    expect(readdirSync(directory).some((name) => name.endsWith(".lock"))).toBe(
      true,
    );
    const contender = `import { acquireListenLock } from ${JSON.stringify(moduleUrl)}; try { const release=acquireListenLock(process.argv[1], 'queue'); console.log('owned'); setTimeout(()=>{release()},1000); } catch { console.log('busy'); }`;
    const start = () =>
      new Promise<string>((resolveOutput, reject) => {
        const child = spawn(process.execPath, [
          "--input-type=module",
          "-e",
          contender,
          directory,
        ]);
        let output = "";
        child.stdout.on("data", (data) => {
          output += data;
        });
        child.on("error", reject);
        child.on("exit", () => resolveOutput(output.trim()));
      });
    const results = await Promise.all([start(), start()]);
    expect(results.sort()).toEqual(["busy", "owned"]);
    expect(
      readdirSync(directory).filter((name) => name.endsWith(".lock")),
    ).toEqual([]);
    expect(existsSync(directory)).toBe(true);
  });
});

describe("process generation ownership", () => {
  it("recovers a reused live PID while preserving the next owner's generation", () => {
    let started = "100";
    linuxIdentity(() => started);
    const oldRelease = acquireListenLock(directory, "queue");
    const old = lockOwner();
    expect(JSON.parse(readFileSync(old.file, "utf8"))).toEqual({
      version: 1,
      identity: `linux:${BOOT_ID}:100`,
    });
    expect(process.kill(process.pid, 0)).toBe(true);
    started = "200"; // The same PID now belongs to a different process generation.
    const release = acquireListenLock(directory, "queue");
    const current = lockOwner();
    expect(current.owner).not.toBe(old.owner);
    expect(existsSync(old.file)).toBe(false);
    oldRelease();
    expect(existsSync(current.file)).toBe(true);
    expect(() => acquireListenLock(directory, "queue")).toThrow(
      "Another listener",
    );
    release();
  });

  it("keeps an owner with the same process-start identity active", () => {
    linuxIdentity(() => "100");
    const release = acquireListenLock(directory, "queue");
    const old = lockOwner();
    expect(() => acquireListenLock(directory, "queue")).toThrow(
      "Another listener",
    );
    expect(existsSync(old.file)).toBe(true);
    release();
  });

  it.each([
    "darwin",
    "win32",
  ] as const)("compares persisted %s identity before recovering a reused live PID", (target) => {
    platform(target);
    vi.stubEnv("SystemRoot", "C:\\Windows");
    let generation = 1;
    vi.mocked(execFileSync).mockImplementation((file) => {
      if (file === "/usr/sbin/sysctl")
        return "{ sec = 1700000000, usec = 123 }\n";
      return target === "darwin"
        ? `Wed Sep 9 12:34:0${generation} 2026\n`
        : `63893018096000000${generation}\r\n`;
    });
    const oldRelease = acquireListenLock(directory, "queue");
    const old = lockOwner();
    expect(() => acquireListenLock(directory, "queue")).toThrow(
      "Another listener",
    );
    generation++;
    const release = acquireListenLock(directory, "queue");
    const current = lockOwner();
    expect(current.owner).not.toBe(old.owner);
    oldRelease();
    expect(existsSync(current.file)).toBe(true);
    release();
  });

  it.each([
    "",
    "not-json",
    '{"version":1,"identity":null}',
    '{"version":1,"identity":"unknown"}',
    '{"version":2,"identity":"linux:0385d3d5-2a65-41bd-9596-c3dd32c06ddd:100"}',
  ])("retains a live PID with legacy or unverifiable owner content %j", (content) => {
    linuxIdentity(() => "100");
    const release = acquireListenLock(directory, "queue");
    const old = lockOwner();
    writeFileSync(old.file, content);
    expect(() => acquireListenLock(directory, "queue")).toThrow(
      /primitive listen --subscription local-[a-f0-9-]{36}/,
    );
    expect(readFileSync(old.file, "utf8")).toBe(content);
    release();
  });

  it("retains a live PID when the current OS identity becomes unreadable", () => {
    let started: string | null = "100";
    linuxIdentity(() => started);
    const release = acquireListenLock(directory, "queue");
    const old = lockOwner();
    started = null;
    expect(() => acquireListenLock(directory, "queue")).toThrow(
      "cannot be verified",
    );
    expect(existsSync(old.file)).toBe(true);
    release();
  });

  it("recovers a provably dead PID even with a legacy blank owner file", () => {
    linuxIdentity(() => "100");
    const oldRelease = acquireListenLock(directory, "queue");
    writeFileSync(lockOwner().file, "");
    vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("gone"), { code: "ESRCH" });
    });
    const release = acquireListenLock(directory, "queue");
    oldRelease();
    expect(existsSync(lockOwner().file)).toBe(true);
    release();
  });

  it("does not unlink a concurrent replacement after identifying an exact stale owner", () => {
    let started = "100";
    linuxIdentity(() => started);
    const oldRelease = acquireListenLock(directory, "queue");
    const stale = lockOwner();
    started = "200";
    let replacement: (() => void) | undefined;
    let replacementFile = "";
    vi.mocked(unlinkSync).mockImplementation((file) => {
      if (file === stale.file && !replacement) {
        // A competitor wins between the stale check and our exact-owner unlink.
        actualFs.unlinkSync(stale.file);
        actualFs.rmdirSync(stale.path);
        replacement = acquireListenLock(directory, "queue");
        replacementFile = lockOwner().file;
      }
      actualFs.unlinkSync(file);
    });
    expect(() => acquireListenLock(directory, "queue")).toThrow(
      "Another listener",
    );
    expect(replacementFile).not.toBe("");
    expect(existsSync(replacementFile)).toBe(true);
    oldRelease();
    expect(existsSync(replacementFile)).toBe(true);
    expect(
      readdirSync(directory).filter((entry) => entry.startsWith(".claim-")),
    ).toEqual([]);
    replacement?.();
  });
});

describe("native process identity readers", () => {
  it("parses Linux starttime despite spaces and parentheses in comm and includes boot identity", () => {
    linuxIdentity(() => "987654321");
    expect(listenProcessIdentity(123)).toBe(`linux:${BOOT_ID}:987654321`);
    expect(vi.mocked(readFileSync).mock.calls.map(([path]) => path)).toEqual([
      "/proc/sys/kernel/random/boot_id",
      "/proc/123/stat",
    ]);
  });

  it("uses fixed macOS tools with numeric PID, UTC, C locale and bounded execution", () => {
    platform("darwin");
    vi.mocked(execFileSync).mockImplementation((file) =>
      file === "/usr/sbin/sysctl"
        ? "{ sec = 1700000000, usec = 123 } arbitrary local date\n"
        : "Wed Sep  9 12:34:56 2026\n",
    );
    expect(listenProcessIdentity(123)).toBe(
      "darwin:1700000000:123:Wed Sep 9 12:34:56 2026",
    );
    expect(execFileSync).toHaveBeenNthCalledWith(
      1,
      "/usr/sbin/sysctl",
      ["-n", "kern.boottime"],
      expect.objectContaining({
        timeout: 1000,
        maxBuffer: 4096,
        env: expect.objectContaining({ LC_ALL: "C", TZ: "UTC" }),
      }),
    );
    expect(execFileSync).toHaveBeenNthCalledWith(
      2,
      "/bin/ps",
      ["-p", "123", "-o", "lstart="],
      expect.objectContaining({ stdio: ["ignore", "pipe", "ignore"] }),
    );
  });

  it("uses shell-free Windows PowerShell with an absolute Windows path and invariant UTC start ticks", () => {
    platform("win32");
    vi.stubEnv("SystemRoot", "C:\\Windows");
    vi.mocked(execFileSync).mockReturnValue("638930180960000000\r\n");
    expect(listenProcessIdentity(123)).toBe("win32:638930180960000000");
    expect(execFileSync).toHaveBeenCalledWith(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$ErrorActionPreference='Stop'; (Get-Process -Id 123 -ErrorAction Stop).StartTime.ToUniversalTime().Ticks.ToString([System.Globalization.CultureInfo]::InvariantCulture)",
      ],
      expect.objectContaining({
        timeout: 2000,
        maxBuffer: 4096,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  });

  it.each([
    "darwin",
    "win32",
  ] as const)("retains live locks on %s native reader failure", (target) => {
    platform(target);
    vi.stubEnv("SystemRoot", "C:\\Windows");
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("unavailable or denied");
    });
    expect(listenProcessIdentity(123)).toBeNull();
    const release = acquireListenLock(directory, "queue");
    expect(() => acquireListenLock(directory, "queue")).toThrow(
      "cannot be verified",
    );
    release();
  });

  it("rejects invalid PIDs before invoking OS tools", () => {
    platform("darwin");
    vi.mocked(execFileSync).mockClear();
    for (const pid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      expect(listenProcessIdentity(pid)).toBeNull();
    }
    expect(execFileSync).not.toHaveBeenCalled();
  });
});

it.skipIf(process.platform === "win32")(
  "refuses registration after directory sync failure and retries durability on reconnect",
  () => {
    const realSync = vi.mocked(fsyncSync).getMockImplementation();
    let directoriesSynced = 0;
    vi.mocked(fsyncSync).mockImplementation((fd) => {
      if (fstatSync(fd).isDirectory())
        throw new Error("injected directory sync failure");
      realSync?.(fd);
    });
    expect(() => resolveListenSubscription(directory, "account-a")).toThrow(
      "directory sync failure",
    );
    const saved = readFileSync(
      join(directory, "listen", "account-a", "default.json"),
      "utf8",
    );
    vi.mocked(fsyncSync).mockImplementation((fd) => {
      if (fstatSync(fd).isDirectory()) directoriesSynced++;
      realSync?.(fd);
    });
    const retry = resolveListenSubscription(directory, "account-a");
    expect(retry.name).toBe(JSON.parse(saved).name);
    expect(directoriesSynced).toBe(3);
    retry.release();
  },
);
