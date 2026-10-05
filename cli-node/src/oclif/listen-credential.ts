/** The API's code for an account credential creating a pull subscription. */
export const AGENT_CONNECTION_REQUIRED =
  "pull_subscription_requires_agent_connection";

export const AGENT_CONNECTION_REQUIRED_MESSAGE =
  "primitive listen needs a connected agent credential, which limits the subscription to one address. Connect one with primitive agent connect and select its profile. With an account API key, watch mail with primitive emails watch or receive it at an HTTP webhook endpoint instead.";

/** Connected-agent API keys are the only credentials that can create pull subscriptions. */
export function isConnectedAgentKey(
  apiKey: string | undefined,
): apiKey is string {
  return apiKey?.startsWith("pconn_") === true;
}
