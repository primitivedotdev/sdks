import { Command } from "@oclif/core";
import { JSON_OUTPUT_FLAG } from "../json-output.js";

// `primitive version` prints the line `primitive --version` prints (oclif's
// user agent: name/version platform-arch node-version), or with --json the
// same facts as fields. It reads only the running CLI and Node, so it needs
// no login and does not call the API.

export type VersionInfo = {
  version: string;
  platform: string;
  arch: string;
  node: string;
};

/** The facts `--version` prints, as fields. `node` is Node's version without its leading v. */
export function versionInfo(config: {
  version: string;
  platform: string;
  arch: string;
}): VersionInfo {
  return {
    version: config.version,
    platform: config.platform,
    arch: config.arch,
    node: process.versions.node,
  };
}

class VersionCommand extends Command {
  static description =
    "Print the CLI's version, with the platform, architecture and Node version it runs on: the same line `primitive --version` prints. With --json, print them as fields. Needs no login and does not call the API.";

  static summary = "Print the CLI version";

  static examples = [
    "<%= config.bin %> version",
    "<%= config.bin %> version --json",
  ];

  static flags = {
    json: JSON_OUTPUT_FLAG,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(VersionCommand);
    this.log(
      flags.json
        ? JSON.stringify(versionInfo(this.config), null, 2)
        : this.config.userAgent,
    );
  }
}

export default VersionCommand;
