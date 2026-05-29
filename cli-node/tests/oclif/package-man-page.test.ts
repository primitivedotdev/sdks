import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CLI package man page", () => {
  it("declares and ships the primitive(1) man page", () => {
    const packageJsonPath = new URL("../../package.json", import.meta.url);
    const manPagePath = new URL("../../man/primitive.1", import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      bin?: Record<string, string>;
      files?: string[];
      man?: string[];
    };

    expect(packageJson.bin).toEqual({
      primitive: "./bin/run.js",
      prim: "./bin/run.js",
    });
    expect(packageJson.files).toContain("man");
    expect(packageJson.man).toEqual(["./man/primitive.1"]);
    expect(existsSync(manPagePath)).toBe(true);

    const manPage = readFileSync(manPagePath, "utf8");
    expect(manPage).toContain(".TH PRIMITIVE 1");
    expect(manPage).toContain("primitive send");
    expect(manPage).toContain("primitive domains zone-file");
    expect(manPage).toContain("primitive functions deploy");
  });
});
