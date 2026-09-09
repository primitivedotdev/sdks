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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireListenLock,
  listenIdentity,
  normalizeListenOrigin,
  resolveListenSubscription,
} from "../../src/oclif/listen-state.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, fsyncSync: vi.fn(actual.fsyncSync) };
});

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "primitive-listen-state-"));
});
afterEach(() => {
  vi.mocked(fsyncSync).mockRestore();
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
    const script = `import { acquireListenLock } from ${JSON.stringify(module)}; acquireListenLock(process.argv[1], 'queue');`;
    execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      script,
      directory,
    ]);
    expect(readdirSync(directory).some((name) => name.endsWith(".lock"))).toBe(
      true,
    );
    const contender = `import { acquireListenLock } from ${JSON.stringify(module)}; try { const release=acquireListenLock(process.argv[1], 'queue'); console.log('owned'); setTimeout(()=>{release()},1000); } catch { console.log('busy'); }`;
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
