import { Command } from "@oclif/core";
import { setBoardEnvironment } from "@primitivedotdev/sdk/board";
import { createAuthenticatedCliApiClient } from "../api-client.js";

/** Global `vb` flags that would send the Primitive credential to another board. */
const OTHER_BOARD_FLAGS = new Set(["--url", "--scope"]);

/** The first flag before `--` that points the run at a board other than Primitive's, if any. */
export function otherBoardFlag(argv: readonly string[]): string | undefined {
  for (const arg of argv) {
    if (arg === "--") return undefined;
    const name = arg.split("=", 1)[0] ?? arg;
    if (OTHER_BOARD_FLAGS.has(name)) return name;
  }
  return undefined;
}

export default class BoardCommand extends Command {
  static summary = "Use the Primitive board with your Primitive login";

  static description =
    `Run any \`vb\` command on the Primitive board, as your Primitive login.

  Everything after \`board\` goes to the Board CLI (\`@vercel/board\`), which
  talks to the board under your Primitive API base URL with your saved login,
  PRIMITIVE_API_KEY, or the agent profile PRIMITIVE_AGENT_PROFILE selects.
  BOARD_PROFILE and --as still pick who you write as. To use a board that is
  not Primitive's, run \`vb\` directly: --url and --scope are refused here so
  your Primitive credential never goes to another board.`;

  static examples = [
    "<%= config.bin %> board post dev 'ready to promote?'",
    "<%= config.bin %> board read dev",
    "<%= config.bin %> board tasks claim --ready work --as worker-1",
    "<%= config.bin %> board help",
  ];

  static strict = false;

  async run(): Promise<void> {
    const argv = [...this.argv];
    // Every argument is vb's, so oclif parses none of them.
    await this.parse(BoardCommand, []);
    const refused = otherBoardFlag(argv);
    if (refused) {
      process.stderr.write(
        `primitive board talks only to the Primitive board, so it does not take ${refused}. Run vb ${refused} ... for another board.\n`,
      );
      process.exitCode = 2;
      return;
    }

    const env = process.env;
    const { auth } = await createAuthenticatedCliApiClient({
      apiKey: env.PRIMITIVE_API_KEY,
      apiBaseUrl: env.PRIMITIVE_API_BASE_URL || undefined,
      configDir: this.config.configDir,
    });
    if (!auth.apiKey) {
      process.stderr.write(
        "Not logged in to Primitive. Run `primitive login`, or set PRIMITIVE_API_KEY.\n",
      );
      process.exitCode = 1;
      return;
    }
    setBoardEnvironment({ apiKey: auth.apiKey, apiBaseUrl: auth.apiBaseUrl });

    const { createApp } = await import("@vercel/board/cli");
    const code = await createApp({ appName: `${this.config.bin} board` }).run(
      argv,
    );
    if (code !== 0) process.exitCode = code;
  }
}
