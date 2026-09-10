import { resolve } from "node:path";
import { Command, Flags } from "@oclif/core";
import { writeListenStarter } from "../listen-starter.js";

export default class ListenInitCommand extends Command {
  static description =
    "Create an offline Python event receiver starter. Refuses to overwrite an existing directory.";
  static examples = ["<%= config.bin %> listen init --language python"];
  static flags = {
    language: Flags.string({ options: ["python"], default: "python" }),
    "out-dir": Flags.string({
      description: "New starter directory",
      default: "primitive-listener",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ListenInitCommand);
    const outDir = resolve(flags["out-dir"]);
    try {
      writeListenStarter({ outDir });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        this.error(
          "Target already exists. Choose a new --out-dir; no files were overwritten.",
        );
      }
      throw error;
    }
    this.log(`Created ${outDir}`);
    this.log(`cd '${outDir.replaceAll("'", "'\\''")}'`);
    this.log(
      "primitive listen --subscription my-agent --exec 'python3 accept_event.py'",
    );
    this.log("The acceptance hook needs only Python's standard library.");
    this.log("Optional separate processor setup:");
    this.log("python3 -m venv .venv && . .venv/bin/activate");
    this.log("python3 -m pip install -r requirements.txt");
    this.log(
      "Set PRIMITIVE_API_KEY, then run python3 process_events.py in another terminal.",
    );
  }
}
