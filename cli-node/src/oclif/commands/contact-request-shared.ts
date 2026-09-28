import type { Command } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";

export async function contactCommandContext(
  command: Command,
  flags: { "api-key"?: string; "api-base-url"?: string },
) {
  const { apiClient, auth } = await createAuthenticatedCliApiClient({
    configDir: command.config.configDir,
    apiKey: flags["api-key"],
    apiBaseUrl: flags["api-base-url"],
  });
  if (!auth.connectedAgent)
    throw new Error(
      "Contact requests require a saved connected-agent profile. Select it with PRIMITIVE_AGENT_PROFILE.",
    );
  return {
    apiClient,
    apiKey: auth.apiKey,
    identity: auth.connectedAgent,
    configDir: command.config.configDir,
  };
}
export function reportContactCommand(
  command: Command,
  result: { exitCode: number; data: Record<string, unknown> },
): void {
  command.log(JSON.stringify(result.data, null, 2));
  if (result.exitCode) process.exitCode = result.exitCode;
}
