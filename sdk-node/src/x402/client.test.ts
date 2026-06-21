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

  it("charge() requires an amount", async () => {
    await expect(
      // @ts-expect-error amount omitted on purpose
      client().charge({ network: "base-sepolia" }),
    ).rejects.toThrow(/positive integer string/);
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
