/**
 * x402 agent-to-agent payments.
 *
 * `charge()` (payee) asks for a payment; `pay()` (payer) signs and settles it
 * with the customer's own key. The signing is local and non-custodial; the key
 * never leaves the caller. The server resolves the real payee address, verifies
 * every signed field against its own records, and enforces the spend policy, so
 * the SDK's job is just: derive the bound authorization, sign, and submit.
 */
import type { Address } from "viem";
import {
  deriveEip3009Nonce,
  type TransferAuthorization,
  toPaymentPayload,
  transferWithAuthorizationTypedData,
  type X402Signer,
} from "./sign.js";

const CHAIN_IDS: Record<string, number> = {
  "base-sepolia": 84532,
  base: 8453,
};

// Generous past-dating for clock skew + headroom past challenge expiry so a
// verified payment still has time to settle. Mirrors the server's window.
const CLOCK_SKEW_SEC = 5 * 60;
const SETTLEMENT_MARGIN_SEC = 5 * 60;

const DEFAULT_BASE_URL = "https://api.primitive.dev";

export interface X402PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  extra: { name: string; version: string };
}

/** A request for payment, as returned by `charge()` / the platform. */
export interface X402Challenge {
  id: string;
  network: string;
  amount: string;
  pay_to: string;
  nonce_binding: {
    interaction_id: string;
    challenge_step_id: string;
    challenge_nonce: string;
  };
  payment_requirements: X402PaymentRequirements;
  expires_at: string;
}

export interface X402Receipt {
  id: string;
  status: string;
  settle_tx: string | null;
}

export interface X402ChargeInput {
  /** Amount in token base units (USDC has 6 decimals, so "10000" = 0.01). */
  amount: string;
  /** Defaults to "base-sepolia". */
  network?: string;
  /** The org id allowed to pay this challenge (on-net binding). */
  payerOrg?: string;
  description?: string;
  /** A URL identifying the thing being paid for. */
  resource?: string;
  /** Seconds until the challenge expires (default 1h). */
  expiresIn?: number;
}

export class X402Error extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "X402Error";
    this.status = status;
    this.body = body;
  }
}

export interface X402ClientOptions {
  /** API key. Defaults to `process.env.PRIMITIVE_API_KEY`. */
  apiKey?: string;
  /** API base URL. Defaults to the production host. */
  baseUrl?: string;
  /** Override the fetch implementation (e.g. for testing). */
  fetch?: typeof fetch;
}

export class X402Client {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: X402ClientOptions = {}) {
    this.#apiKey = options.apiKey ?? process.env.PRIMITIVE_API_KEY ?? "";
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#fetch = options.fetch ?? fetch;
  }

  async #request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.#fetch(`${this.#baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: T;
      error?: { code?: string; message?: string };
    };
    if (!res.ok || json.success === false) {
      throw new X402Error(
        json.error?.message ?? `request failed with ${res.status}`,
        res.status,
        json,
      );
    }
    return (json.data ?? (json as unknown)) as T;
  }

  /** Request a payment (payee side). Returns the challenge to hand to the payer. */
  charge(input: X402ChargeInput): Promise<X402Challenge> {
    const body: Record<string, unknown> = {
      amount: input.amount,
      network: input.network ?? "base-sepolia",
    };
    if (input.payerOrg) body.payer_org = input.payerOrg;
    if (input.description) body.description = input.description;
    if (input.resource) body.resource = input.resource;
    if (input.expiresIn !== undefined) body.expires_in = input.expiresIn;
    return this.#request<X402Challenge>("POST", "/v1/x402/challenges", body);
  }

  /**
   * Pay a challenge (payer side). Derives the interaction-bound authorization,
   * signs it locally with the caller's key, and submits it for settlement.
   */
  async pay(
    challenge: X402Challenge,
    options: { signer: X402Signer },
  ): Promise<X402Receipt> {
    const chainId = CHAIN_IDS[challenge.network];
    if (chainId === undefined) {
      throw new X402Error(`unsupported network: ${challenge.network}`, 0);
    }
    const pr = challenge.payment_requirements;

    const nonce = deriveEip3009Nonce({
      interactionId: challenge.nonce_binding.interaction_id,
      challengeStepId: challenge.nonce_binding.challenge_step_id,
      challengeNonce: challenge.nonce_binding.challenge_nonce,
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAtSec = Math.floor(Date.parse(challenge.expires_at) / 1000);

    const auth: TransferAuthorization = {
      from: options.signer.address,
      to: pr.payTo as Address,
      value: BigInt(pr.maxAmountRequired),
      validAfter: BigInt(nowSec - CLOCK_SKEW_SEC),
      validBefore: BigInt(expiresAtSec + SETTLEMENT_MARGIN_SEC),
      nonce,
    };

    const signature = await options.signer.signTypedData(
      transferWithAuthorizationTypedData(
        {
          name: pr.extra.name,
          version: pr.extra.version,
          chainId,
          verifyingContract: pr.asset as Address,
        },
        auth,
      ),
    );

    return this.#request<X402Receipt>(
      "POST",
      `/v1/x402/challenges/${challenge.id}/pay`,
      { payment: toPaymentPayload(challenge.network, auth, signature) },
    );
  }
}

export function createX402Client(options: X402ClientOptions = {}): X402Client {
  return new X402Client(options);
}
