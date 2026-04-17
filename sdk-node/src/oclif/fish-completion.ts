import {
  openapiDocument,
  operationManifest,
  type PrimitiveOperationManifest,
} from "../openapi/index.js";

type OpenApiTag = {
  description?: string;
  name?: string;
};

function fishEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function tagDescriptions(): Map<string, string> {
  const descriptions = new Map<string, string>();
  const tags = ((openapiDocument as { tags?: OpenApiTag[] }).tags ??
    []) as OpenApiTag[];

  for (const tag of tags) {
    if (tag.name) {
      descriptions.set(toKebabCase(tag.name), tag.description ?? tag.name);
    }
  }

  return descriptions;
}

function operationCondition(operation: PrimitiveOperationManifest): string {
  return `__fish_${fishEscape(BIN_PLACEHOLDER)}_using_operation ${fishEscape(operation.tagCommand)} ${fishEscape(operation.command)}`;
}

const BIN_PLACEHOLDER = "__BIN__";

export function renderFishCompletion(binName: string): string {
  const tagDescriptionByCommand = tagDescriptions();
  const topLevelTopics = [
    ...new Set(operationManifest.map((operation) => operation.tagCommand)),
  ];
  const lines = [
    `function __fish_${binName}_needs_command`,
    "  set -l cmd (commandline -opc)",
    "  test (count $cmd) -le 1",
    "end",
    "",
    `function __fish_${binName}_topic_needs_subcommand`,
    "  set -l cmd (commandline -opc)",
    "  test (count $cmd) -eq 2",
    '  and test "$cmd[2]" = "$argv[1]"',
    "end",
    "",
    `function __fish_${binName}_using_operation`,
    "  set -l cmd (commandline -opc)",
    "  test (count $cmd) -ge 3",
    '  and test "$cmd[2]" = "$argv[1]"',
    '  and test "$cmd[3]" = "$argv[2]"',
    "end",
    "",
    `function __fish_${binName}_using_root_command`,
    "  set -l cmd (commandline -opc)",
    "  test (count $cmd) -eq 2",
    '  and test "$cmd[2]" = "$argv[1]"',
    "end",
    "",
    `complete -c ${binName} -f -n '__fish_${binName}_needs_command' -a 'list-operations' -d 'List all generated API operations'`,
    `complete -c ${binName} -f -n '__fish_${binName}_needs_command' -a 'completion' -d 'Show shell completion output or installation instructions'`,
    `complete -c ${binName} -f -n '__fish_${binName}_needs_command' -a 'autocomplete' -d 'Install or display shell autocomplete for bash, zsh, and powershell'`,
    `complete -c ${binName} -f -n '__fish_${binName}_needs_command' -a 'help' -d 'Display help for ${binName}'`,
  ];

  for (const topic of topLevelTopics) {
    lines.push(
      `complete -c ${binName} -f -n '__fish_${binName}_needs_command' -a '${fishEscape(topic)}' -d '${fishEscape(tagDescriptionByCommand.get(topic) ?? topic)}'`,
    );
  }

  lines.push(
    `complete -c ${binName} -f -n '__fish_${binName}_using_root_command completion' -a 'bash zsh powershell fish' -d 'Shell type'`,
  );

  for (const topic of topLevelTopics) {
    const topicOperations = operationManifest.filter(
      (operation) => operation.tagCommand === topic,
    );
    for (const operation of topicOperations) {
      lines.push(
        `complete -c ${binName} -f -n '__fish_${binName}_topic_needs_subcommand ${fishEscape(topic)}' -a '${fishEscape(operation.command)}' -d '${fishEscape(operation.summary ?? `${operation.method} ${operation.path}`)}'`,
      );

      for (const parameter of [
        ...operation.pathParams,
        ...operation.queryParams,
      ]) {
        lines.push(
          `complete -c ${binName} -n '${operationCondition(operation).replace(BIN_PLACEHOLDER, binName)}' -l '${fishEscape(parameter.name.replace(/_/g, "-"))}' -r -d '${fishEscape(parameter.description ?? parameter.name)}'`,
        );
      }

      lines.push(
        `complete -c ${binName} -n '${operationCondition(operation).replace(BIN_PLACEHOLDER, binName)}' -l 'api-key' -r -d 'Primitive API key (defaults to PRIMITIVE_API_KEY)'`,
        `complete -c ${binName} -n '${operationCondition(operation).replace(BIN_PLACEHOLDER, binName)}' -l 'base-url' -r -d 'API base URL (defaults to PRIMITIVE_API_URL or production)'`,
      );

      if (operation.hasJsonBody) {
        lines.push(
          `complete -c ${binName} -n '${operationCondition(operation).replace(BIN_PLACEHOLDER, binName)}' -l 'body' -r -d 'JSON request body'`,
          `complete -c ${binName} -n '${operationCondition(operation).replace(BIN_PLACEHOLDER, binName)}' -l 'body-file' -r -d 'Path to a JSON file used as the request body'`,
        );
      }

      if (operation.binaryResponse) {
        lines.push(
          `complete -c ${binName} -n '${operationCondition(operation).replace(BIN_PLACEHOLDER, binName)}' -l 'output' -r -d 'Write binary response bytes to a file'`,
        );
      }
    }
  }

  lines.push(
    `complete -c ${binName} -l help -d 'Show help for ${binName}'`,
    `complete -c ${binName} -l version -d 'Show version for ${binName}'`,
  );

  return `${lines.join("\n")}\n`;
}
