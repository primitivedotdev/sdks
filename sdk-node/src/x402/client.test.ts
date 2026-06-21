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
});

describe("X402Client.autopay", () => {
  it("pays a 402 challenge and retries the request once", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo, _init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/pay"))
        return jsonResponse({
          success: true,
          data: { id: CHALLENGE.id, status: "settled", settle_tx: null },
        });
      // first hit to the resource -> 402 with the challenge; second -> 200
      const resourceHits = calls.filter(
        (u) => u === "https://resource.example/thing",
      ).length;
      return resourceHits >= 2
        ? jsonResponse({ ok: true })
        : jsonResponse(CHALLENGE, 402);
    });
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const wrapped = client.autopay({ signer });
    const res = await wrapped("https://resource.example/thing");
    expect(res.status).toBe(200);
    // resource hit twice (402 then retry) with a /pay in between
    expect(calls.filter((u) => u.endsWith("/pay")).length).toBe(1);
  });

  it("passes through non-402 responses untouched", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }, 200));
    const client = new X402Client({
      apiKey: "k",
      baseUrl: "https://api.example",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const res = await client.autopay({ signer })("https://resource.example/x");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
