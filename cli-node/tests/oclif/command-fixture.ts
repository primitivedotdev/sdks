import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Interfaces } from "@oclif/core";

/**
 * Class-level tests need real parsing and config directories, not discovery of
 * the entire application inside every timed invocation. Registry tests and
 * built CLI smokes exercise full discovery separately.
 */
export function commandFixture(root: string): Interfaces.Options {
  const pkg = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ) as Pick<Interfaces.PJSON, "name" | "version" | "oclif">;
  return {
    root,
    ignoreManifest: true,
    userPlugins: false,
    devPlugins: false,
    pjson: {
      name: pkg.name,
      version: pkg.version,
      oclif: {
        bin: pkg.oclif.bin,
        dirname: pkg.oclif.dirname,
        topicSeparator: pkg.oclif.topicSeparator,
      },
    },
  };
}
