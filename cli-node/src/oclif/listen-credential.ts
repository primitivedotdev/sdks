/** The API's code for an account credential creating a pull subscription. */
export const AGENT_CONNECTION_REQUIRED =
  "pull_subscription_requires_agent_connection";

export const AGENT_CONNECTION_REQUIRED_MESSAGE =
  "primitive listen needs a connected agent credential, which limits the subscription to one address. Connect one with primitive agent connect and select its profile. With an account API key, watch mail with primitive emails watch or receive it at an HTTP webhook endpoint instead.";

/** The API's code for a full API key that was revoked. */
export const KEY_REVOKED = "key_revoked";

/** What a listener says when its agent's key was revoked: connect again, as signing in cannot bring it back. */
export const KEY_REVOKED_MESSAGE =
  "This agent's key was revoked, so it no longer works. Connect the agent again for a new one; signing in does not bring it back.";

/** Connected-agent API keys are the only credentials that can create pull subscriptions. */
export function isConnectedAgentKey(
  apiKey: string | undefined,
): apiKey is string {
  return apiKey?.startsWith("pconn_") === true;
}
