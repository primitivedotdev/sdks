import { Args, Command, Errors, Flags } from "@oclif/core";
import {
  deleteCliConfig,
  emptyCliConfig,
  loadCliConfig,
  normalizeCliEnvironmentName,
  redactCliEnvironment,
  removeCliEnvironment,
  resolveConfigEnvironment,
  saveCliConfig,
  upsertCliEnvironment,
} from "../cli-config.js";

function loadOrCreateConfig(configDir: string) {
  return loadCliConfig(configDir) ?? emptyCliConfig();
}

function redactConfig(config: ReturnType<typeof emptyCliConfig>) {
  return {
    ...config,
    environments: Object.fromEntries(
      Object.entries(config.environments).map(([name, environment]) => [
        name,
        redactCliEnvironment(environment),
      ]),
    ),
  };
}

export class ConfigSetCommand extends Command {
  static hidden = true;
  static summary = "Set hidden Primitive CLI request config";

  static flags = {
    environment: Flags.string({
      char: "e",
      description: "Environment name to create or update",
    }),
    "api-base-url-1": Flags.string({
      description: "Primary API base URL",
    }),
    "api-base-url-2": Flags.string({
      description: "Attachments-supporting API base URL",
    }),
    header: Flags.string({
      description: "Request header in name=value form. Repeatable.",
      multiple: true,
    }),
    "unset-header": Flags.string({
      description: "Request header name to remove. Repeatable.",
      multiple: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigSetCommand);
    const headers = flags.header ?? [];
    if (
      flags["api-base-url-1"] === undefined &&
      flags["api-base-url-2"] === undefined &&
      headers.length === 0 &&
      (flags["unset-header"] ?? []).length === 0
    ) {
      throw new Errors.CLIError(
        "Nothing to set. Pass an API base URL, --header, or --unset-header.",
        { exit: 1 },
      );
    }

    const config = upsertCliEnvironment({
      apiBaseUrl1: flags["api-base-url-1"],
      apiBaseUrl2: flags["api-base-url-2"],
      config: loadOrCreateConfig(this.config.configDir),
      environmentName: flags.environment,
      headers,
      unsetHeaders: flags["unset-header"],
    });
    saveCliConfig(this.config.configDir, config);

    process.stderr.write(
      `Primitive CLI environment ${config.current_environment} is active.\n`,
    );
  }
}

export class ConfigUseCommand extends Command {
  static hidden = true;
  static summary = "Switch active Primitive CLI request config";

  static args = {
    environment: Args.string({
      description: "Environment name to use",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigUseCommand);
    const environment = normalizeCliEnvironmentName(args.environment);
    const config = loadOrCreateConfig(this.config.configDir);
    if (!config.environments[environment]) {
      throw new Errors.CLIError(
        `Primitive CLI environment ${environment} is not configured.`,
        { exit: 1 },
      );
    }
    saveCliConfig(this.config.configDir, {
      ...config,
      current_environment: environment,
    });
    process.stderr.write(
      `Primitive CLI environment ${environment} is active.\n`,
    );
  }
}

export class ConfigListCommand extends Command {
  static hidden = true;
  static summary = "List hidden Primitive CLI request configs";

  static flags = {
    json: Flags.boolean({
      description: "Print JSON",
    }),
    "show-secrets": Flags.boolean({
      description: "Show header values instead of redacting them",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigListCommand);
    const config = loadOrCreateConfig(this.config.configDir);
    const output = flags["show-secrets"] ? config : redactConfig(config);

    if (flags.json) {
      this.log(JSON.stringify(output, null, 2));
      return;
    }

    const entries = Object.entries(config.environments);
    if (entries.length === 0) {
      this.log("No Primitive CLI environments configured.");
      return;
    }

    const activeEnvironment = resolveConfigEnvironment(config)?.name ?? null;
    for (const [name, environment] of entries) {
      const active = activeEnvironment === name ? "*" : " ";
      const headerNames = Object.keys(environment.headers ?? {});
      this.log(`${active} ${name}`);
      if (environment.api_base_url_1) {
        this.log(`    api_base_url_1: ${environment.api_base_url_1}`);
      }
      if (environment.api_base_url_2) {
        this.log(`    api_base_url_2: ${environment.api_base_url_2}`);
      }
      this.log(
        `    headers: ${headerNames.length > 0 ? headerNames.join(", ") : "(none)"}`,
      );
    }
  }
}

export class ConfigResetCommand extends Command {
  static hidden = true;
  static summary = "Reset hidden Primitive CLI request config";

  static flags = {
    environment: Flags.string({
      char: "e",
      description: "Only remove one environment",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigResetCommand);
    if (flags.environment === undefined) {
      deleteCliConfig(this.config.configDir);
      process.stderr.write("Primitive CLI request config reset.\n");
      return;
    }

    const environment = normalizeCliEnvironmentName(flags.environment);
    const config = loadCliConfig(this.config.configDir);
    if (!config?.environments[environment]) {
      process.stderr.write(
        `Primitive CLI environment ${environment} was not configured.\n`,
      );
      return;
    }

    const nextConfig = removeCliEnvironment(config, environment);
    if (Object.keys(nextConfig.environments).length === 0) {
      deleteCliConfig(this.config.configDir);
    } else {
      saveCliConfig(this.config.configDir, nextConfig);
    }
    process.stderr.write(`Primitive CLI environment ${environment} removed.\n`);
  }
}
