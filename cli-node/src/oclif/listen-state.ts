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
import { join } from "node:path";

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
  writeFileSync(join(candidate, owner), "", { mode: 0o600, flag: "wx" });
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
      if (!match || processAlive(Number(match[1])))
        throw new ListenStateError(
          "Another listener is using this subscription. Stop it before reconnecting.",
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
