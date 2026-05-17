import { Command } from "@oclif/core";
import {
  FUNCTION_TEMPLATES,
  type FunctionTemplateSummary,
  formatFunctionTemplateList,
  serializeFunctionTemplate,
} from "../function-templates.js";

class FunctionsTemplatesCommand extends Command {
  static enableJsonFlag = true;

  static description =
    `List Primitive Function templates available to \`primitive functions init\`.

  The default table is optimized for quick terminal discovery. Use
  --json when an agent or script needs stable metadata for searching,
  ranking, or choosing a template programmatically.`;

  static summary = "List available Primitive Function templates";

  static examples = [
    "<%= config.bin %> functions templates",
    "<%= config.bin %> functions templates --json",
    "<%= config.bin %> functions init my-fn --template email-reply",
  ];

  static flags = {};

  async run(): Promise<FunctionTemplateSummary[] | undefined> {
    const { flags } = await this.parse(FunctionsTemplatesCommand);

    if (flags.json) {
      return FUNCTION_TEMPLATES.map(serializeFunctionTemplate);
    }

    this.log(formatFunctionTemplateList(FUNCTION_TEMPLATES));
  }
}

export default FunctionsTemplatesCommand;
