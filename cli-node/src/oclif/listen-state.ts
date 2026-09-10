import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, win32 } from "node:path";

export class ListenStateError extends Error {}

export function normalizeListenOrigin(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new ListenStateError(
      "The API base URL must be an HTTP(S) URL without credentials, query, or fragment.",
    );
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function listenIdentity(origin: string, accountId: string): string {
  return createHash("sha256")
    .update(JSON.stringify([normalizeListenOrigin(origin), accountId]))
    .digest("hex");
}

function privateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())
    throw new ListenStateError("Listener state must be a private directory.");
  chmodSync(path, 0o700);
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

// Process IDs can be reused while a crashed listener's lock remains on disk.
// Read only OS lifecycle metadata, never command lines or process environments.
export function listenProcessIdentity(pid: number): string | null {
  if (!Number.isSafeInteger(pid) || pid < 1) return null;
  try {
    if (process.platform === "linux") {
      const boot = readFileSync(
        "/proc/sys/kernel/random/boot_id",
        "utf8",
      ).trim();
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      // comm can contain spaces and parentheses. Fields after its last closing
      // parenthesis start at field 3; starttime is field 22.
      const end = stat.lastIndexOf(")");
      const started = stat
        .slice(end + 1)
        .trim()
        .split(/\s+/)[19];
      if (
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(boot) ||
        !stat.startsWith(`${pid} (`) ||
        end < 0 ||
        !started ||
        !/^\d+$/.test(started)
      )
        return null;
      return `linux:${boot}:${started}`;
    }
    if (process.platform === "darwin") {
      const options = {
        encoding: "utf8" as const,
        timeout: 1000,
        maxBuffer: 4096,
        stdio: ["ignore", "pipe", "ignore"] as ["ignore", "pipe", "ignore"],
        env: { LC_ALL: "C", TZ: "UTC", PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
      };
      const boot = execFileSync(
        "/usr/sbin/sysctl",
        ["-n", "kern.boottime"],
        options,
      );
      const bootMatch = /\{\s*sec\s*=\s*(\d+),\s*usec\s*=\s*(\d+)\s*\}/.exec(
        boot,
      );
      const started = execFileSync(
        "/bin/ps",
        ["-p", String(pid), "-o", "lstart="],
        options,
      )
        .trim()
        .replace(/\s+/g, " ");
      if (
        !bootMatch ||
        !/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(
          started,
        )
      )
        return null;
      return `darwin:${bootMatch[1]}:${bootMatch[2]}:${started}`;
    }
    if (process.platform === "win32") {
      const root = process.env.SystemRoot;
      if (!root || !win32.isAbsolute(root)) return null;
      const started = execFileSync(
        win32.join(
          root,
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        ),
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `$ErrorActionPreference='Stop'; (Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks.ToString([System.Globalization.CultureInfo]::InvariantCulture)`,
        ],
        {
          encoding: "utf8",
          timeout: 2000,
          maxBuffer: 4096,
          windowsHide: true,
          stdio: ["ignore", "pipe", "ignore"],
        },
      ).trim();
      return /^\d{1,20}$/.test(started) ? `win32:${started}` : null;
    }
  } catch {
    // An unavailable OS reader never authorizes stealing a live process's lock.
  }
  return null;
}

function ownerIdentity(path: string): string | null {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024)
      return null;
    const saved: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (
      !saved ||
      typeof saved !== "object" ||
      !("version" in saved) ||
      saved.version !== 1 ||
      !("identity" in saved) ||
      typeof saved.identity !== "string"
    )
      return null;
    // Unrecognized records (including blank files from older releases) cannot
    // establish a mismatch with a process that is still alive.
    return /^(?:linux:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}:\d+|darwin:\d+:\d+:[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}|win32:\d{1,20})$/.test(
      saved.identity,
    )
      ? saved.identity
      : null;
  } catch {
    return null;
  }
}

function removeOwner(path: string, owner: string): void {
  try {
    unlinkSync(join(path, owner));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Another contender may already have installed a new, nonempty generation.
  // rmdir cannot remove it; never recursively remove the shared lock path.
  try {
    rmdirSync(path);
  } catch (error) {
    if (
      !["ENOENT", "ENOTEMPTY", "EEXIST"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      throw error;
  }
}

export function acquireListenLock(
  directory: string,
  scope: string,
): () => void {
  privateDirectory(directory);
  const key = createHash("sha256").update(scope).digest("hex");
  const path = join(directory, `${key}.lock`);
  const owner = `${process.pid}-${randomUUID()}`;
  const candidate = mkdtempSync(join(directory, ".claim-"));
  chmodSync(candidate, 0o700);
  writeFileSync(
    join(candidate, owner),
    JSON.stringify({
      version: 1,
      identity: listenProcessIdentity(process.pid),
    }),
    { mode: 0o600, flag: "wx" },
  );
  let installed = false;
  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        renameSync(candidate, path);
        installed = true;
        break;
      } catch (error) {
        if (
          !["EEXIST", "ENOTEMPTY"].includes(
            (error as NodeJS.ErrnoException).code ?? "",
          )
        )
          throw error;
      }
      let entries: string[];
      try {
        entries = readdirSync(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (entries.length === 0) continue;
      const match =
        entries.length === 1
          ? /^(\d+)-[a-f0-9-]{36}$/.exec(entries[0] ?? "")
          : null;
      const pid = match ? Number(match[1]) : null;
      let stale = pid !== null && !processAlive(pid);
      if (!stale && pid !== null) {
        const saved = ownerIdentity(join(path, entries[0] ?? ""));
        const current = saved === null ? null : listenProcessIdentity(pid);
        stale = saved !== null && current !== null && saved !== current;
      }
      if (!stale)
        throw new ListenStateError(
          "Another listener is using this subscription, or its owner cannot be verified. Stop the original listener before reconnecting. To use a separate subscription instead, run: primitive listen --subscription local-" +
            randomUUID(),
        );
      removeOwner(path, entries[0] ?? "");
    }
    if (!installed)
      throw new ListenStateError(
        "Subscription lock changed concurrently. Retry the command.",
      );
  } finally {
    if (!installed) removeOwner(candidate, owner);
  }
  let released = false;
  return () => {
    if (!released) {
      released = true;
      removeOwner(path, owner);
    }
  };
}

export function resolveListenSubscription(
  configDir: string,
  identity: string,
  explicit?: string,
): { name: string; release: () => void } {
  const directory = join(configDir, "listen", identity);
  privateDirectory(directory);
  let name = explicit;
  if (name === undefined) {
    const unlock = acquireListenLock(directory, "default-name");
    try {
      const file = join(directory, "default.json");
      try {
        if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink())
          throw new ListenStateError("Invalid listener identity file.");
        const saved = JSON.parse(readFileSync(file, "utf8")) as {
          name?: unknown;
        };
        if (
          typeof saved.name !== "string" ||
          !/^local-[a-f0-9-]{36}$/.test(saved.name)
        )
          throw new ListenStateError("Invalid listener identity file.");
        name = saved.name;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        name = `local-${randomUUID()}`;
        // Persist before registration, so a lost create response resumes by name.
        const temporary = join(directory, `.state-${randomUUID()}`);
        const fd = openSync(temporary, "wx", 0o600);
        try {
          writeFileSync(fd, `${JSON.stringify({ name })}\n`);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        renameSync(temporary, file);
      }
      // Persist the name and new state directories before a remote destination can exist.
      // Repeat after reading so a previous failed sync cannot be bypassed by reconnecting.
      // Windows does not support opening directories for fsync through this API.
      if (process.platform !== "win32") {
        for (const path of [directory, join(configDir, "listen"), configDir]) {
          const directoryFd = openSync(path, "r");
          try {
            fsyncSync(directoryFd);
          } finally {
            closeSync(directoryFd);
          }
        }
      }
    } finally {
      unlock();
    }
  }
  if (!name || name.length > 64 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name))
    throw new ListenStateError(
      "Use a subscription name of 1–64 letters, digits, underscores, or hyphens.",
    );
  return {
    name,
    release: acquireListenLock(directory, `subscription:${name}`),
  };
}
