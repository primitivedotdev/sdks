import { describe, expect, it, vi } from "vitest";
import {
  loadBuiltin,
  loadNodeFs,
  loadNodeFsPromises,
} from "../../src/payloads/node-fs.js";

describe("node-fs lazy loaders", () => {
  it("loads node:fs at call time", async () => {
    const fs = await loadNodeFs("test");
    expect(typeof fs.createWriteStream).toBe("function");
  });

  it("loads node:fs/promises at call time", async () => {
    const fsPromises = await loadNodeFsPromises("test");
    expect(typeof fsPromises.open).toBe("function");
    expect(typeof fsPromises.readFile).toBe("function");
  });

  it("falls back to a dynamic import when getBuiltinModule is unavailable", async () => {
    const spy = vi
      .spyOn(process, "getBuiltinModule")
      .mockReturnValue(undefined);
    try {
      const fsPromises = await loadNodeFsPromises("pushFile");
      expect(spy).toHaveBeenCalledWith("node:fs/promises");
      expect(typeof fsPromises.stat).toBe("function");
    } finally {
      spy.mockRestore();
    }
  });

  it("falls back to a dynamic import when getBuiltinModule throws", async () => {
    const spy = vi.spyOn(process, "getBuiltinModule").mockImplementation(() => {
      throw new Error("builtin loading not supported");
    });
    try {
      const fs = await loadNodeFs("pullFile");
      expect(spy).toHaveBeenCalledWith("node:fs");
      expect(typeof fs.createWriteStream).toBe("function");
    } finally {
      spy.mockRestore();
    }
  });

  it("throws an error naming the operation when the module cannot load", async () => {
    await expect(
      loadBuiltin("node:module-that-does-not-exist", "pushFile"),
    ).rejects.toThrow(/^pushFile requires file system access/);
  });
});
