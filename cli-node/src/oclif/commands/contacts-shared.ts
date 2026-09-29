import { type Command, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import {
  type ContactRequest,
  ContactsApiError,
  contactAgentAddress,
  runContactRequest,
} from "../contacts.js";

export const contactFlags = {
  json: Flags.boolean({
    description: "Print JSON (already the default for contact commands)",
  }),
  "api-key": Flags.string({
    description: "API key override",
    env: "PRIMITIVE_API_KEY",
  }),
  "api-base-url": Flags.string({
    description: API_BASE_URL_FLAG_DESCRIPTION,
    env: "PRIMITIVE_API_BASE_URL",
    hidden: true,
  }),
  time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
};
export const contactPageFlags = {
  cursor: Flags.string({
    description: "Continue after the cursor returned by the previous page",
  }),
  limit: Flags.integer({
    description: "Page size (1-100)",
    default: 50,
    min: 1,
    max: 100,
  }),
};
export const contactAgentFlag = {
  agent: Flags.string({
    description:
      "Agent address (defaults to the selected connected profile's own address)",
  }),
};
export const contactVersionFlag = {
  "if-version": Flags.string({
    description:
      "Use this exact version; otherwise read the current version once. Conflicts are never retried.",
  }),
};
export const contactNameFlags = {
  name: Flags.string({
    description: "Shared directory display name (at most 200 characters)",
    exclusive: ["clear-name"],
  }),
  "clear-name": Flags.boolean({
    description: "Clear the shared directory display name",
    exclusive: ["name"],
  }),
};
export const contactPreferenceFlags = {
  purpose: Flags.string({
    description:
      "This agent's purpose for the contact (at most 2000 characters)",
    exclusive: ["clear-purpose"],
  }),
  "clear-purpose": Flags.boolean({
    description: "Clear this agent's purpose",
    exclusive: ["purpose"],
  }),
  notify: Flags.boolean({
    description:
      "Opt into notifications for this agent; --no-notify disables. New memberships default to off. Requires a receiver configured to use contacts.",
    allowNo: true,
  }),
};

type ParsedContactFlags = {
  "api-key"?: string;
  "api-base-url"?: string;
  time?: boolean;
  json?: boolean;
  "if-version"?: string;
  "clear-name"?: boolean;
  "clear-purpose"?: boolean;
} & Pick<
  ContactRequest,
  "agent" | "cursor" | "limit" | "name" | "purpose" | "notify"
>;

export async function runContactsCommand(
  command: Command,
  request: Pick<ContactRequest, "action" | "target" | "address">,
  flags: ParsedContactFlags,
): Promise<void> {
  const { apiClient, auth, baseUrlOverridden } =
    await createAuthenticatedCliApiClient({
      configDir: command.config.configDir,
      apiKey: flags["api-key"],
      apiBaseUrl: flags["api-base-url"],
    });
  await runWithTiming(flags.time, async () => {
    try {
      const data = await runContactRequest(apiClient.client, {
        ...request,
        agent:
          request.target === "agent"
            ? contactAgentAddress(
                flags.agent,
                auth.connectedAgent?.agentAddress,
              )
            : undefined,
        cursor: flags.cursor,
        limit: flags.limit,
        name: flags.name,
        clearName: flags["clear-name"],
        purpose: flags.purpose,
        clearPurpose: flags["clear-purpose"],
        notify: flags.notify,
        ifVersion: flags["if-version"],
      });
      command.log(JSON.stringify(data, null, 2));
    } catch (error) {
      if (!(error instanceof ContactsApiError)) throw error;
      if (error.directoryAvailable)
        process.stderr.write(
          "The directory contact is available, but the agent membership was not saved. Retry agent contacts add after resolving the error.\n",
        );
      const payload = extractErrorPayload(error.payload);
      writeErrorWithHints(payload);
      surfaceUnauthorizedHint({
        auth,
        baseUrlOverridden,
        configDir: command.config.configDir,
        payload,
      });
      process.exitCode = 1;
    }
  });
}
