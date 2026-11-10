import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAccount } from "../../src/oclif/commands/doctor.js";
import {
  pickDefaultFromAddress,
  resolveDefaultFrom,
} from "../../src/oclif/outbound-defaults.js";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

function clientAnswering(
  answer: (path: string) => Response,
): PrimitiveApiClient {
  return new PrimitiveApiClient({
    apiKey: ["prim", "test"].join("_"),
    apiBaseUrl: "https://api.example.test/v1",
    fetch: (async (input: Request | string | URL) =>
      answer(
        new URL(input instanceof Request ? input.url : input).pathname,
      )) as typeof fetch,
  });
}

function refusal(code = "grant_forbidden"): Response {
  return Response.json(
    { success: false, error: { code, message: "Not allowed" } },
    { status: 403 },
  );
}

function grantWithScope(scope: unknown, credentialKind = "org_key"): Response {
  return Response.json({
    success: true,
    data: {
      org_id: ACCOUNT_ID,
      auth_method: credentialKind === "oauth" ? "user_grant" : "api_key",
      key_id: null,
      grant: {
        credential_kind: credentialKind,
        template: null,
        permissions: ["mail:send"],
        mail_scope: scope,
        resources: null,
        expires_at: null,
      },
    },
  });
}

function whoamiWith(
  memberAddress: string | null,
  suggestion: string | null = null,
): Response {
  return Response.json({
    success: true,
    data: {
      member_address: memberAddress
        ? { address: memberAddress, name: null }
        : null,
      member_address_suggestion: suggestion,
      org_id: ACCOUNT_ID,
      user_id: "user-1",
      role: "member",
      request_id: "req-1",
      auth_method: "user_grant",
      key_id: null,
    },
  });
}

const outboundStatus = () =>
  Response.json({
    success: true,
    data: {
      ready: true,
      summary: "ok",
      sendable_domains: ["acme.example", "acme-mail.primitive.email"],
      domains: [],
      next_actions: [],
    },
  });

const sendable = () =>
  Response.json({
    success: true,
    data: { allowed: true, summary: "ok" },
  });

const authContext = {
  auth: { apiKey: ["prim", "test"].join("_") },
  baseUrlOverridden: false,
  configDir: "/nonexistent",
} as never;

function scope(
  addresses: string[],
  direction?: string,
  domains: string[] = [],
) {
  return { addresses, domains, depth: "raw", direction };
}

/** A client whose answers are chosen by path; it records each request's path and body. */
function recordingClient(answers: Record<string, () => Response>) {
  const requests: { path: string; body: unknown }[] = [];
  const client = new PrimitiveApiClient({
    apiKey: ["prim", "test"].join("_"),
    apiBaseUrl: "https://api.example.test/v1",
    fetch: (async (input: Request | string | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const path = new URL(request ? request.url : String(input)).pathname;
      const text = request ? await request.clone().text() : init?.body;
      requests.push({
        path,
        body: typeof text === "string" && text ? JSON.parse(text) : null,
      });
      const key = Object.keys(answers).find((suffix) => path.endsWith(suffix));
      return key ? (answers[key] as () => Response)() : refusal();
    }) as typeof fetch,
  });
  return { client, requests };
}

describe("resolveDefaultFrom for a key", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the single address the grant names", async () => {
    const client = clientAnswering((path) =>
      path.endsWith("/whoami/grant")
        ? grantWithScope(scope(["me@example.test"]))
        : refusal(),
    );

    await expect(pickDefaultFromAddress(client, authContext)).resolves.toBe(
      "me@example.test",
    );
    await expect(resolveDefaultFrom(client, authContext)).resolves.toEqual({
      address: "me@example.test",
      source: "granted_address",
    });
  });

  it.each([
    [
      "several addresses",
      scope(["a@example.test", "b@example.test"]),
      "Addresses you may send from: a@example.test, b@example.test.",
    ],
    [
      "one address and a whole domain",
      scope(["a@example.test"], undefined, ["example.test"]),
      "Also any address at: example.test.",
    ],
    ["no addresses", scope([]), "Pass the address to send from with --from"],
    [
      "an inbound-only scope",
      scope(["me@example.test"], "inbound"),
      "Pass the address to send from with --from",
    ],
  ])(
    "asks for --from when the grant has %s",
    async (_case, grantScope, listed) => {
      const client = clientAnswering((path) =>
        path.endsWith("/whoami/grant") ? grantWithScope(grantScope) : refusal(),
      );

      const error = await resolveDefaultFrom(client, authContext).catch(
        (caught: Error) => caught,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("--from has no default");
      expect((error as Error).message).toContain(listed);
    },
  );

  it("asks an organization-wide key for --from, listing the sendable domains, never agent@", async () => {
    const { client, requests } = recordingClient({
      "/whoami/grant": () => grantWithScope("org"),
      "/outbound/status": outboundStatus,
    });

    const error = (await resolveDefaultFrom(client, authContext).catch(
      (caught: Error) => caught,
    )) as Error;
    expect(error.message).toBe(
      "This credential may send from any address at the organization's sending domains, so --from has no default. Any address at: acme.example, acme-mail.primitive.email. Pass the one to use with --from, for example --from you@acme.example.",
    );
    expect(error.message).not.toContain("agent@");
    expect(requests.map((request) => request.path)).not.toContain(
      "/v1/domains",
    );
  });

  it("explains a failure to read the grant", async () => {
    const client = clientAnswering(() =>
      Response.json(
        { success: false, error: { code: "internal_error", message: "boom" } },
        { status: 500 },
      ),
    );

    await expect(pickDefaultFromAddress(client, authContext)).rejects.toThrow(
      "Could not tell which addresses this credential may send from",
    );
  });
});

describe("resolveDefaultFrom for a person", () => {
  it.each(["oauth", "member"])(
    "sends a %s login as their member address when the API would let them",
    async (kind) => {
      const { client, requests } = recordingClient({
        "/whoami/grant": () => grantWithScope("org", kind),
        "/whoami": () => whoamiWith("dana@yuuja.example"),
        "/sendability": sendable,
      });

      await expect(
        resolveDefaultFrom(client, authContext, {
          to: "alice@example.com, bob@example.com",
        }),
      ).resolves.toEqual({
        address: "dana@yuuja.example",
        source: "member_address",
      });
      expect(
        requests.find((request) => request.path.endsWith("/sendability"))?.body,
      ).toEqual({ to: "alice@example.com", from: "dana@yuuja.example" });
      // Never the organization's domains.
      expect(requests.map((request) => request.path)).not.toContain(
        "/v1/domains",
      );
    },
  );

  it("keeps the member address when the check cannot say, and lets the send decide", async () => {
    const client = recordingClient({
      "/whoami/grant": () => grantWithScope("org", "oauth"),
      "/whoami": () => whoamiWith("dana@yuuja.example"),
      "/sendability": () =>
        Response.json(
          { success: false, error: { code: "internal_error", message: "x" } },
          { status: 500 },
        ),
    }).client;

    await expect(
      pickDefaultFromAddress(client, authContext, { to: "alice@example.com" }),
    ).resolves.toBe("dana@yuuja.example");
  });

  it("refuses when their member address cannot send, saying why and listing what they may use", async () => {
    const client = recordingClient({
      "/whoami/grant": () =>
        grantWithScope(
          scope(["dana@yuuja.example", "dana@acme.example"]),
          "oauth",
        ),
      "/whoami": () => whoamiWith("dana@yuuja.example"),
      "/sendability": () =>
        Response.json(
          {
            success: false,
            error: {
              code: "cannot_send_from_domain",
              message: "yuuja.example is not verified for sending.",
            },
          },
          { status: 403 },
        ),
    }).client;

    const error = (await resolveDefaultFrom(client, authContext, {
      to: "alice@example.com",
    }).catch((caught: Error) => caught)) as Error;
    expect(error.message).toContain(
      "Your member address dana@yuuja.example cannot send this message, so --from has no default: ",
    );
    expect(error.message).toContain(
      "yuuja.example is not verified for sending.",
    );
    expect(error.message).toContain(
      "Addresses you may send from: dana@acme.example. Pass the one to use with --from, for example --from dana@acme.example.",
    );
  });

  it("refuses a person with no member address, naming the claim command, never agent@", async () => {
    const client = recordingClient({
      "/whoami/grant": () => grantWithScope("org", "oauth"),
      "/whoami": () => whoamiWith(null, "dana@acme.example"),
      "/outbound/status": outboundStatus,
    }).client;

    const error = (await resolveDefaultFrom(client, authContext, {
      to: "alice@example.com",
    }).catch((caught: Error) => caught)) as Error;
    expect(error.message).toBe(
      "You have no member address of your own to send from, so --from has no default. To claim one, run `primitive account provision-member-address --address dana@acme.example`. Any address at: acme.example, acme-mail.primitive.email. Pass the one to use with --from, for example --from you@acme.example.",
    );
    expect(error.message).not.toContain("agent@");
  });
});

describe("doctor checkAccount", () => {
  it("does not print null when the credential may not see the email", async () => {
    const { outcome } = await checkAccount(
      clientAnswering(() =>
        Response.json({
          success: true,
          data: { id: ACCOUNT_ID, email: null, plan: "pro" },
        }),
      ),
    );

    expect(outcome.status).toBe("ok");
    expect(outcome.message).not.toContain("null");
  });

  it("warns instead of reporting a rejected key on a grant refusal", async () => {
    const { outcome } = await checkAccount(clientAnswering(() => refusal()));

    expect(outcome.status).toBe("warn");
    expect(outcome.message).toContain("cannot read the account");
  });
});
