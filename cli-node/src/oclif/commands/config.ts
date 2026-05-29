import { existsSync } from "node:fs";
import { Args, Command, Errors, Flags } from "@oclif/core";
import {
  acquireCliCredentialsLock,
  credentialsPath,
  deleteCliCredentials,
} from "../auth.js";
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

export function upsertCliEnvironmentAndClearCredentialsIfSwitched(params: {
  apiBaseUrl?: string;
  configDir: string;
  environmentName?: string;
  headers?: string[];
  unsetHeaders?: string[];
}): {
  environment: string | null;
  previousEnvironment: string | null;
  removedCredentials: boolean;
} {
  const previousConfig = loadOrCreateConfig(params.configDir);
  const previousActiveEnvironment = resolveConfigEnvironment(previousConfig);
  const previousEnvironment = previousActiveEnvironment?.name ?? null;
  const config = upsertCliEnvironment({
    apiBaseUrl: params.apiBaseUrl,
    config: previousConfig,
    environmentName: params.environmentName,
    headers: params.headers,
    unsetHeaders: params.unsetHeaders,
  });
  const activeEnvironment = resolveConfigEnvironment(config);
  const environment = activeEnvironment?.name ?? null;
  const shouldClearCredentials =
    existsSync(credentialsPath(params.configDir)) &&
    (previousEnvironment !== environment ||
      previousActiveEnvironment?.config.api_base_url !==
        activeEnvironment?.config.api_base_url);
  let removedCredentials = false;

  if (shouldClearCredentials) {
    const releaseLock = acquireCliCredentialsLock(params.configDir);
    try {
      saveCliConfig(params.configDir, config);
      removedCredentials = existsSync(credentialsPath(params.configDir));
      deleteCliCredentials(params.configDir);
    } finally {
      releaseLock();
    }
  } else {
    saveCliConfig(params.configDir, config);
  }

  return { environment, previousEnvironment, removedCredentials };
}

export function switchCliEnvironment(
  configDir: string,
  environmentName: string,
): {
  environment: string;
  previousEnvironment: string | null;
  removedCredentials: boolean;
} {
  const environment = normalizeCliEnvironmentName(environmentName);
  const config = loadOrCreateConfig(configDir);
  if (!config.environments[environment]) {
    throw new Errors.CLIError(
      `Primitive CLI environment ${environment} is not configured.`,
      { exit: 1 },
    );
  }

  const previousEnvironment = resolveConfigEnvironment(config)?.name ?? null;
  const nextConfig = {
    ...config,
    current_environment: environment,
  };

  const shouldClearCredentials = previousEnvironment !== environment;
  let removedCredentials = false;
  if (shouldClearCredentials) {
    const releaseLock = acquireCliCredentialsLock(configDir);
    try {
      saveCliConfig(configDir, nextConfig);
      removedCredentials = existsSync(credentialsPath(configDir));
      deleteCliCredentials(configDir);
    } finally {
      releaseLock();
    }
  } else {
    saveCliConfig(configDir, nextConfig);
  }

  return { environment, previousEnvironment, removedCredentials };
}

export class ConfigSetCommand extends Command {
  static summary = "Set a Primitive CLI request environment";

  static flags = {
    environment: Flags.string({
      char: "e",
      description:
        "Environment name to create or update. Defaults to the active environment, or default when none is active.",
    }),
    "api-base-url": Flags.string({
      description: "API base URL",
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
      flags["api-base-url"] === undefined &&
      headers.length === 0 &&
      (flags["unset-header"] ?? []).length === 0
    ) {
      throw new Errors.CLIError(
        "Nothing to set. Pass an API base URL, --header, or --unset-header.",
        { exit: 1 },
      );
    }

    const { environment, removedCredentials } =
      upsertCliEnvironmentAndClearCredentialsIfSwitched({
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
        environmentName: flags.environment,
        headers,
        unsetHeaders: flags["unset-header"],
      });

    process.stderr.write(
      `Primitive CLI environment ${environment} is active.\n`,
    );
    if (removedCredentials) {
      process.stderr.write(
        "Removed saved Primitive CLI credentials. Run `primitive login` to authenticate in the active environment.\n",
      );
    }
  }
}

export class ConfigUseCommand extends Command {
  static summary = "Switch the active Primitive CLI request environment";
  static description =
    "Switch the active Primitive CLI request environment. When this switches to a different environment, the CLI removes saved OAuth credentials so the next authenticated command signs in against the newly active API host.";

  static args = {
    environment: Args.string({
      description: "Environment name to use",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigUseCommand);
    const { environment, removedCredentials } = switchCliEnvironment(
      this.config.configDir,
      args.environment,
    );
    process.stderr.write(
      `Primitive CLI environment ${environment} is active.\n`,
    );
    if (removedCredentials) {
      process.stderr.write(
        "Removed saved Primitive CLI credentials. Run `primitive login` to authenticate in the active environment.\n",
      );
    }
  }
}

export class ConfigListCommand extends Command {
  static summary = "List Primitive CLI request environments";

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
      if (environment.api_base_url) {
        this.log(`    api_base_url: ${environment.api_base_url}`);
      }
      this.log(
        `    headers: ${headerNames.length > 0 ? headerNames.join(", ") : "(none)"}`,
      );
    }
  }
}

export class ConfigResetCommand extends Command {
  static summary = "Reset Primitive CLI request environments";

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

export class ConfigCommand extends ConfigListCommand {
  static hidden = true;
  static summary = "Manage Primitive CLI request environments";
  static description =
    "Manage local Primitive CLI request environments for API endpoint overrides and request headers.";
}
