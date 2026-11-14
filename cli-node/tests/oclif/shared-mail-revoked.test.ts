import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  KEY_REVOKED,
  KEY_REVOKED_MESSAGE,
} from "../../src/oclif/listen-credential.js";
import { ensureSharedMailSubscription } from "../../src/oclif/shared-mail-transport.js";

describe("the shared notification listener and a revoked agent key", () => {
  it("says to connect the agent again, not that the subscription failed", async () => {
    const apiClient = new PrimitiveApiClient({
      apiKey: `pconn_${"a".repeat(64)}`,
      apiBaseUrl: "https://api.example.test/v1",
      fetch: (async () =>
        Response.json(
          {
            success: false,
            error: { code: KEY_REVOKED, message: "This API key was revoked." },
          },
          { status: 401 },
        )) as typeof fetch,
    });
    const refused = ensureSharedMailSubscription({
      apiClient,
      subscription: "primitive-notify",
      signal: new AbortController().signal,
    });
    await expect(refused).rejects.toMatchObject({
      message: KEY_REVOKED_MESSAGE,
      code: KEY_REVOKED,
      status: 401,
    });
  });
});
