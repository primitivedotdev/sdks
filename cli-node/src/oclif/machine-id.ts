import { randomUUID } from "node:crypto";
import {
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { AgentConnectionSetupError } from "./connected-agent-profile.js";

/** The shape the server accepts for a machine id. */
export const MACHINE_ID = /^[A-Za-z0-9._-]{8,128}$/;

const FILE = "machine-id";

function readMachineId(path: string): string | null {
  try {
    const info = lstatSync(path);
    if (!info.isFile() || info.size > 256) throw new Error("invalid");
    const value = readFileSync(path, "utf8").trim();
    if (!MACHINE_ID.test(value)) throw new Error("invalid");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new AgentConnectionSetupError(
      `This machine's id file (${FILE} in the CLI config directory) is unreadable or invalid. Nothing was changed.`,
    );
  }
}

/**
 * A random id for this CLI install, made once and kept in its config
 * directory. A session grant names it, so a grant is redeemed only from the
 * machine it was made for. It is an identifier, not a secret: on its own it
 * proves nothing, since redeeming also needs the owner's own login.
 */
export function machineId(configDir: string): string {
  const path = join(configDir, FILE);
  const existing = readMachineId(path);
  if (existing) return existing;
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  const value = randomUUID();
  // Written whole under a private name, then linked into place, so a reader
  // never sees a partial file and a concurrent first run keeps one id.
  const temporary = join(configDir, `.${FILE}-${value}`);
  try {
    writeFileSync(temporary, `${value}\n`, { flag: "wx", mode: 0o600 });
    linkSync(temporary, path);
    return value;
  } catch (error) {
    // Another process made it first; theirs is this machine's id.
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const raced = readMachineId(path);
    if (!raced)
      throw new AgentConnectionSetupError(
        `This machine's id file (${FILE} in the CLI config directory) could not be read. Nothing was changed.`,
      );
    return raced;
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      /* Only the linked file matters. */
    }
  }
}
