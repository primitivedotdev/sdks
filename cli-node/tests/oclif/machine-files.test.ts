import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectManagedBlock,
  jsonIndentation,
  MachineFileError,
  readManagedFile,
  renderManagedBlock,
  upsertManagedBlock,
  writeManagedFile,
} from "../../src/oclif/machine-files.js";

const directories: string[] = [];
function temp(): string {
  const directory = mkdtempSync(join(tmpdir(), "machine-files-"));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const body = "## Primitive\n\n- One line.";

describe("managed block", () => {
  it("appends to user text with one blank line and is stable on a second pass", () => {
    const once = upsertManagedBlock("# Mine\n\nKeep this.\n", body);
    expect(once).toBe(`# Mine\n\nKeep this.\n\n${renderManagedBlock(body)}\n`);
    expect(upsertManagedBlock(once, body)).toBe(once);
    expect(inspectManagedBlock(once, body)).toEqual({ state: "ok" });
  });

  it("replaces only the block and keeps text before and after byte for byte", () => {
    const before = "Intro line\n\n";
    const after = "\n\nTrailing notes  \nno newline at end";
    const old = `${before}<!-- primitive:managed-block v=0 START -->\nold text\n<!-- primitive:managed-block END -->${after}`;
    expect(inspectManagedBlock(old, body)).toEqual({
      state: "outdated",
      version: 0,
    });
    const next = upsertManagedBlock(old, body);
    expect(next).toBe(`${before}${renderManagedBlock(body)}${after}`);
    expect(upsertManagedBlock(next, body)).toBe(next);
  });

  it("keeps CRLF files CRLF and recognises its own block in them", () => {
    const text = "line one\r\nline two\r\n";
    const once = upsertManagedBlock(text, body);
    expect(once.startsWith(text)).toBe(true);
    expect(once.replace(/\r\n/g, "")).not.toContain("\n");
    expect(inspectManagedBlock(once, body)).toEqual({ state: "ok" });
    expect(upsertManagedBlock(once, body)).toBe(once);
  });

  it("refuses malformed markers instead of guessing", () => {
    const twoStarts = `<!-- primitive:managed-block v=1 START -->\na\n<!-- primitive:managed-block v=1 START -->\n<!-- primitive:managed-block END -->\n`;
    expect(inspectManagedBlock(twoStarts, body).state).toBe("malformed");
    expect(() => upsertManagedBlock(twoStarts, body)).toThrow(MachineFileError);
    const reversed = `<!-- primitive:managed-block END -->\n<!-- primitive:managed-block v=1 START -->\n`;
    expect(inspectManagedBlock(reversed, body).state).toBe("malformed");
    const edited = "<!-- primitive:managed-block v=1 START (edited) -->\n";
    expect(inspectManagedBlock(edited, body).state).toBe("malformed");
  });
});

describe("managed file writes", () => {
  it("backs up before replacing and keeps the file mode", () => {
    const directory = temp();
    const path = join(directory, "CLAUDE.md");
    writeFileSync(path, "original\n", { mode: 0o640 });
    const read = readManagedFile(path);
    if (read.state !== "present") throw new Error("expected file");
    const { backup } = writeManagedFile({
      read,
      content: "next\n",
      now: () => new Date("2026-10-02T12:00:00.000Z"),
    });
    expect(readFileSync(path, "utf8")).toBe("next\n");
    expect(backup).toBe(`${path}.primitive-bak-20261002T120000Z`);
    expect(readFileSync(backup ?? "", "utf8")).toBe("original\n");
    const after = readManagedFile(path);
    expect(after.state === "present" && after.mode).toBe(0o640);
    expect(
      readdirSync(directory).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
  });

  it("refuses to overwrite a file that changed after it was read", () => {
    const directory = temp();
    const path = join(directory, "AGENTS.md");
    writeFileSync(path, "first\n");
    const read = readManagedFile(path);
    if (read.state !== "present") throw new Error("expected file");
    writeFileSync(path, "someone else\n");
    expect(() => writeManagedFile({ read, content: "mine\n" })).toThrow(
      MachineFileError,
    );
    expect(readFileSync(path, "utf8")).toBe("someone else\n");
  });

  it("writes through a symlink to the user's real file and keeps the link", () => {
    const directory = temp();
    mkdirSync(join(directory, "dotfiles"));
    const real = join(directory, "dotfiles", "CLAUDE.md");
    writeFileSync(real, "linked\n");
    const link = join(directory, "CLAUDE.md");
    symlinkSync(real, link);
    const read = readManagedFile(link);
    if (read.state !== "present") throw new Error("expected file");
    writeManagedFile({ read, content: "updated\n" });
    expect(readlinkSync(link)).toBe(real);
    expect(readFileSync(real, "utf8")).toBe("updated\n");
  });

  it("reports non-text and broken-link files instead of reading them", () => {
    const directory = temp();
    const binary = join(directory, "binary.md");
    writeFileSync(binary, Buffer.from([0xff, 0xfe, 0x00, 0x41]));
    expect(readManagedFile(binary).state).toBe("invalid");
    const broken = join(directory, "broken.md");
    symlinkSync(join(directory, "missing.md"), broken);
    expect(readManagedFile(broken).state).toBe("invalid");
  });

  it("detects JSON indentation", () => {
    expect(jsonIndentation('{\n    "a": 1\n}\n')).toBe("    ");
    expect(jsonIndentation('{\n\t"a": 1\n}\n')).toBe("\t");
    expect(jsonIndentation("{}")).toBe(2);
  });
});
