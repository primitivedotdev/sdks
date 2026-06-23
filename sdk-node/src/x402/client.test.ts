import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type X402Challenge, X402Client, X402Error } from "./client.js";
import type { TransferWithAuthorizationTypedData } from "./sign.js";

const account = privateKeyToAccount(generatePrivateKey());
const signer = {
  address: account.address,
  signTypedData: (td: TransferWithAuthorizationTypedData) =>
    account.signTypedData(td),
};

const CHALLENGE: X402Challenge = {
  id: "11111111-1111-4111-8111-111111111111",
  network: "base-sepolia",
  amount: "10000",
  pay_to: "0x1111111111111111111111111111111111111111",
  nonce_binding: {
    interaction_id: "11111111-1111-4111-8111-111111111111@x402.primitive",
    challenge_step_id: "f00dface-0000-0000-0000-0000000000aa",
    challenge_nonce:
      "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
  },
  payment_requirements: {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "10000",
    payTo: "0x1111111111111111111111111111111111111111",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    extra: { name: "USDC", version: "2" },
  },
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("X402Client.charge", () => {
  it("POSTs the challenge request and returns the challenge", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: CHALLENGE }),
    );
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example/",
      fetch: fetchMock,
    });

    const ch = await client.charge({
      amount: "10000",
      network: "base-sepolia",
      description: "demo",
    });
    expect(ch.id).toBe(CHALLENGE.id);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.example/v1/x402/challenges");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      amount: "10000",
      network: "base-sepolia",
      description: "demo",
    });
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer k",
    );
  });
});

describe("X402Client.pay", () => {
  it("signs the authorization locally and submits it for settlement", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: {
          id: CHALLENGE.id,
          status: "settled",
          settle_tx: `0x${"a".repeat(64)}`,
        },
      }),
    );
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });

    const receipt = await client.pay(CHALLENGE, { signer });
    expect(receipt).toMatchObject({ status: "settled" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `https://api.example/v1/x402/challenges/${CHALLENGE.id}/pay`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.payment.x402Version).toBe(1);
    expect(body.payment.scheme).toBe("exact");
    // the authorization is signed FROM the caller's own key, TO the payee
    expect(body.payment.payload.authorization.from.toLowerCase()).toBe(
      account.address.toLowerCase(),
    );
    expect(body.payment.payload.authorization.to).toBe(
      CHALLENGE.payment_requirements.payTo,
    );
    expect(body.payment.payload.authorization.value).toBe("10000");
    expect(body.payment.payload.signature).toMatch(/^0x[0-9a-f]+$/i);
  });

  it("throws X402Error with the status on a non-2xx response", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { success: false, error: { message: "payment_declined" } },
        422,
      ),
    );
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });
    await expect(client.pay(CHALLENGE, { signer })).rejects.toBeInstanceOf(
      X402Error,
    );
    await expect(client.pay(CHALLENGE, { signer })).rejects.toThrow(
      "payment_declined",
    );
  });

  it("throws a clear error on a malformed expires_at (not an opaque BigInt error)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: {} }),
    );
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });
    const bad = { ...CHALLENGE, expires_at: "not-a-date" };
    await expect(client.pay(bad, { signer })).rejects.toThrow(
      /invalid expires_at/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("X402Client input validation", () => {
  const client = () =>
    new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: vi.fn(async () =>
        jsonResponse({ success: true, data: CHALLENGE }),
      ),
    });

  it("charge() rejects an unknown option (e.g. a snake_case typo)", async () => {
    await expect(
      // @ts-expect-error intentionally passing an unknown key
      client().charge({ amount: "10000", payer_org: "x" }),
    ).rejects.toThrow(/unknown charge\(\) option "payer_org"/);
  });

  it("charge() requires an amount or amountUsdc", async () => {
    await expect(client().charge({ network: "base-sepolia" })).rejects.toThrow(
      /positive integer string/,
    );
  });

  it("charge() accepts a human amountUsdc and converts it to base units", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}");
      return jsonResponse({
        success: true,
        data: { ...CHALLENGE, amount: body.amount },
      });
    });
    const c = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const ch = await c.charge({ amountUsdc: "0.01", network: "base-sepolia" });
    expect(ch.amount).toBe("10000");
  });

  it("charge() sends an Idempotency-Key header when given idempotencyKey", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: CHALLENGE }),
    );
    const c = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });
    await c.charge({ amount: "10000", idempotencyKey: "abc-123" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBe(
      "abc-123",
    );
  });

  it("charge() rejects passing both amount and amountUsdc", async () => {
    await expect(
      client().charge({ amount: "10000", amountUsdc: "0.01" }),
    ).rejects.toThrow(/exactly one of/);
  });

  it("registerPayoutAddress() auto-resolves org from /v1/account when omitted", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.endsWith("/v1/account")) {
        return jsonResponse({ success: true, data: { id: "org-xyz" } });
      }
      return jsonResponse({
        success: true,
        data: {
          id: "p1",
          address: account.address,
          network: "base-sepolia",
          label: null,
          is_default: true,
          verified_at: null,
        },
      });
    });
    const c = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await c.registerPayoutAddress(
      { network: "base-sepolia" },
      { signer: account },
    );
    expect(calls.some((u) => u.endsWith("/v1/account"))).toBe(true);
  });

  it("charge() rejects a non-integer / non-positive amount", async () => {
    await expect(client().charge({ amount: "1.5" })).rejects.toThrow(
      /positive integer/,
    );
    await expect(client().charge({ amount: "abc" })).rejects.toThrow(
      /positive integer/,
    );
    await expect(client().charge({ amount: "0" })).rejects.toThrow(
      /positive integer/,
    );
  });

  it("pay() rejects a missing/invalid signer", async () => {
    await expect(
      // @ts-expect-error no signer
      client().pay(CHALLENGE, {}),
    ).rejects.toThrow(/requires options.signer/);
  });
});

describe("X402Client hardening", () => {
  const c = (fetchImpl: typeof fetch) =>
    new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchImpl,
    });

  it("wraps a transport/network error as X402Error with status 0", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      c(fetchMock as unknown as typeof fetch).charge({ amount: "10000" }),
    ).rejects.toMatchObject({ name: "X402Error", status: 0 });
  });

  it("throws X402Error on a non-JSON 2xx body", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("<html>nope</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    );
    await expect(
      c(fetchMock as unknown as typeof fetch).charge({ amount: "10000" }),
    ).rejects.toThrow(/non-JSON response/);
  });

  it("throws X402Error when the success/data envelope is missing", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    await expect(
      c(fetchMock as unknown as typeof fetch).charge({ amount: "10000" }),
    ).rejects.toThrow(/missing success\/data envelope/);
  });

  it("surfaces Retry-After on a rate-limit error", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { message: "rate limited" },
          }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": "12",
            },
          },
        ),
    );
    await expect(
      c(fetchMock as unknown as typeof fetch).charge({ amount: "10000" }),
    ).rejects.toMatchObject({ status: 429, retryAfter: "12" });
  });

  it("rejects a missing API key before making a request", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: CHALLENGE }),
    );
    const client = new X402Client({
      apiKey: "",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });
    await expect(client.charge({ amount: "10000" })).rejects.toThrow(
      /no API key/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pay() rejects a malformed challenge before signing", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: {} }),
    );
    const noPr = {
      ...CHALLENGE,
      payment_requirements: undefined,
    } as unknown as X402Challenge;
    await expect(
      c(fetchMock as unknown as typeof fetch).pay(noPr, { signer }),
    ).rejects.toThrow(/payment_requirements/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pay() rejects an already-expired challenge before signing", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: {} }),
    );
    const expired = {
      ...CHALLENGE,
      expires_at: new Date(Date.now() - 3_600_000).toISOString(),
    };
    await expect(
      c(fetchMock as unknown as typeof fetch).pay(expired, { signer }),
    ).rejects.toThrow(/already expired/);
    // Expired only 2 minutes ago, inside SETTLEMENT_MARGIN_SEC: must still be
    // caught (the guard checks expires_at, not the margin-extended validBefore).
    const expiredRecently = {
      ...CHALLENGE,
      expires_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    };
    await expect(
      c(fetchMock as unknown as typeof fetch).pay(expiredRecently, { signer }),
    ).rejects.toThrow(/already expired/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pay() rejects a network/requirements mismatch before signing", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: {} }),
    );
    const mismatch = {
      ...CHALLENGE,
      payment_requirements: {
        ...CHALLENGE.payment_requirements,
        network: "base",
      },
    };
    await expect(
      c(fetchMock as unknown as typeof fetch).pay(mismatch, { signer }),
    ).rejects.toThrow(/network mismatch/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("X402Client completeness methods", () => {
  const ORG = "11111111-1111-4111-8111-111111111111";
  const signerWithMessage = {
    address: account.address,
    signTypedData: (td: TransferWithAuthorizationTypedData) =>
      account.signTypedData(td),
    signMessage: ({ message }: { message: string }) =>
      account.signMessage({ message }),
  };

  it("registerPayoutAddress signs the org-bound message and POSTs the proof", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: {
          id: "p1",
          address: account.address.toLowerCase(),
          network: "base-sepolia",
          label: null,
          is_default: true,
          verified_at: "2026-01-01T00:00:00.000Z",
        },
      }),
    );
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });
    const res = await client.registerPayoutAddress(
      {
        org: ORG,
        network: "base-sepolia",
        issuedAt: "2026-01-01T00:00:00.000Z",
      },
      { signer: signerWithMessage },
    );
    expect(res.is_default).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.example/v1/x402/payout-addresses");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      address: account.address,
      network: "base-sepolia",
      issued_at: "2026-01-01T00:00:00.000Z",
    });
    expect(body.signature).toMatch(/^0x[0-9a-f]+$/i);
  });

  it("registerPayoutAddress requires a signer with signMessage", async () => {
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: vi.fn(async () => jsonResponse({ success: true, data: {} })),
    });
    await expect(
      client.registerPayoutAddress({ org: ORG }, { signer }),
    ).rejects.toThrow(/signMessage/);
  });

  it("getChallenge GETs the challenge by id", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: CHALLENGE }),
    );
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });
    const ch = await client.getChallenge(CHALLENGE.id);
    expect(ch.id).toBe(CHALLENGE.id);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`https://api.example/v1/x402/challenges/${CHALLENGE.id}`);
    expect(init.method).toBe("GET");
  });

  it("getSpendPolicy reads and setSpendPolicy PATCH-writes the policy", async () => {
    const policy = {
      paused: false,
      max_per_payment: "1000000",
      max_per_day: null,
      allowlist: null,
    };
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: policy }),
    );
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });
    expect(await client.getSpendPolicy()).toMatchObject({
      max_per_payment: "1000000",
    });
    await client.setSpendPolicy({ paused: true });
    const [, putInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(putInit.method).toBe("PUT");
    expect(JSON.parse(putInit.body as string)).toEqual({ paused: true });
  });

  it("listPayoutAddresses GETs the directory", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: [] }),
    );
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });
    expect(await client.listPayoutAddresses()).toEqual([]);
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example/v1/x402/payout-addresses");
  });

  it("listDeclinedPayments GETs the declines log", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: [] }),
    );
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock,
    });
    expect(await client.listDeclinedPayments()).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.example/v1/x402/declined-payments");
    expect(init.method).toBe("GET");
  });
});
