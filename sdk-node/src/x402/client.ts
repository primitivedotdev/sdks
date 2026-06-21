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

// `satisfies Record<keyof X402ChargeInput, true>` makes this a compile-time
// mirror of the interface: adding a field to X402ChargeInput without adding it
// here (or vice versa) is a type error, so the allow-set can't silently drift.
const CHARGE_INPUT_KEYS = {
  amount: true,
  network: true,
  payerOrg: true,
  description: true,
  resource: true,
  expiresIn: true,
} satisfies Record<keyof X402ChargeInput, true>;

export class X402Error extends Error {
  /** HTTP status, or 0 for a client-side / transport error that never reached the server. */
  readonly status: number;
  readonly body: unknown;
  /** The `Retry-After` response header, if the server sent one. */
  readonly retryAfter: string | null;
  constructor(
    message: string,
    status: number,
    body?: unknown,
    options?: { cause?: unknown; retryAfter?: string | null },
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "X402Error";
    this.status = status;
    this.body = body;
    this.retryAfter = options?.retryAfter ?? null;
  }
}

/**
 * Assert a challenge is fully hydrated before signing, so a missing field fails
 * with a named X402Error instead of an opaque viem/BigInt error mid-sign.
 */
function validateChallenge(c: X402Challenge): void {
  const bad = (field: string): never => {
    throw new X402Error(`challenge is missing or malformed: ${field}`, 0);
  };
  if (!c || typeof c !== "object") bad("challenge");
  if (!c.id) bad("id");
  if (!c.network) bad("network");
  if (!c.expires_at) bad("expires_at");
  const nb = c.nonce_binding;
  if (!nb?.interaction_id || !nb.challenge_step_id || !nb.challenge_nonce) {
    bad("nonce_binding");
  }
  const pr = c.payment_requirements;
  if (!pr) bad("payment_requirements");
  if (!pr.maxAmountRequired) bad("payment_requirements.maxAmountRequired");
  if (!/^0x[0-9a-fA-F]{40}$/.test(pr.payTo ?? "")) {
    bad("payment_requirements.payTo (expected a 0x address)");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(pr.asset ?? "")) {
    bad("payment_requirements.asset (expected a 0x address)");
  }
  if (!pr.extra?.name || !pr.extra.version) {
    bad("payment_requirements.extra (name/version)");
  }
}

export interface X402ClientOptions {
  /** API key. Defaults to `process.env.PRIMITIVE_API_KEY`. */
  apiKey?: string;
  /** API base URL. Defaults to the production host. */
  baseUrl?: string;
  /** Override the fetch implementation (e.g. for testing). */
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
}

export class X402Client {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options: X402ClientOptions = {}) {
    this.#apiKey = options.apiKey ?? process.env.PRIMITIVE_API_KEY ?? "";
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
  }

  async #request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: { signal?: AbortSignal },
  ): Promise<T> {
    if (!this.#apiKey) {
      throw new X402Error(
        "no API key configured; set PRIMITIVE_API_KEY or pass { apiKey } to the client",
        0,
      );
    }
    const timeout = AbortSignal.timeout(this.#timeoutMs);
    const signal = init?.signal
      ? AbortSignal.any([timeout, init.signal])
      : timeout;

    let res: Response;
    try {
      res = await this.#fetch(`${this.#baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      // A rejected fetch (DNS, connection refused, TLS, timeout/abort) must not
      // escape as a raw TypeError: callers rely on `instanceof X402Error`, and on
      // pay() a status-0 error signals an indeterminate (maybe-unsent) request.
      const timedOut = cause instanceof Error && cause.name === "TimeoutError";
      throw new X402Error(
        timedOut
          ? `request to ${path} timed out after ${this.#timeoutMs}ms`
          : `request to ${path} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        0,
        undefined,
        { cause },
      );
    }

    const retryAfter = res.headers.get("retry-after");
    const text = await res.text().catch(() => "");
    let json:
      | {
          success?: boolean;
          data?: T;
          error?: { code?: string; message?: string };
        }
      | undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new X402Error(
          `non-JSON response (${res.status}) from ${path}: ${text.slice(0, 200)}`,
          res.status,
          text.slice(0, 500),
          { retryAfter },
        );
      }
    }

    if (!res.ok || json?.success === false) {
      throw new X402Error(
        json?.error?.message ?? `request failed with ${res.status}`,
        res.status,
        json ?? text.slice(0, 500),
        { retryAfter },
      );
    }
    if (!json || json.success !== true || json.data === undefined) {
      throw new X402Error(
        `unexpected response shape (${res.status}) from ${path}: missing success/data envelope`,
        res.status,
        json ?? text.slice(0, 500),
        { retryAfter },
      );
    }
    return json.data;
  }

  /** Request a payment (payee side). Returns the challenge to hand to the payer. */
  async charge(input: X402ChargeInput): Promise<X402Challenge> {
    // Reject unknown keys so a typo (e.g. `payer_org` for `payerOrg`) fails
    // loudly instead of being silently dropped from the request.
    for (const key of Object.keys(input)) {
      if (!(key in CHARGE_INPUT_KEYS)) {
        throw new X402Error(
          `unknown charge() option "${key}"; expected one of: ${Object.keys(CHARGE_INPUT_KEYS).join(", ")}`,
          0,
        );
      }
    }
    if (!input.amount || !/^[1-9][0-9]{0,38}$/.test(input.amount)) {
      throw new X402Error(
        'charge() requires `amount` as a positive integer string in token base units, e.g. "10000"',
        0,
      );
    }
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
    if (
      !options?.signer?.address ||
      typeof options.signer.signTypedData !== "function"
    ) {
      throw new X402Error(
        "pay() requires options.signer with { address, signTypedData } (e.g. a viem LocalAccount)",
        0,
      );
    }
    validateChallenge(challenge);
    const chainId = CHAIN_IDS[challenge.network];
    if (chainId === undefined) {
      throw new X402Error(`unsupported network: ${challenge.network}`, 0);
    }
    const pr = challenge.payment_requirements;
    // The chainId is derived from challenge.network but the token domain
    // (contract/name/version) comes from payment_requirements; cross-check they
    // agree so we never sign a chainId mismatched to the asset.
    if (pr.network !== challenge.network) {
      throw new X402Error(
        `challenge network mismatch: ${challenge.network} vs payment_requirements ${pr.network}`,
        0,
      );
    }
    if (pr.scheme !== "exact") {
      throw new X402Error(`unsupported payment scheme: ${pr.scheme}`, 0);
    }

    const nonce = deriveEip3009Nonce({
      interactionId: challenge.nonce_binding.interaction_id,
      challengeStepId: challenge.nonce_binding.challenge_step_id,
      challengeNonce: challenge.nonce_binding.challenge_nonce,
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAtMs = Date.parse(challenge.expires_at);
    if (Number.isNaN(expiresAtMs)) {
      throw new X402Error(
        `challenge has an invalid expires_at: ${challenge.expires_at}`,
        0,
      );
    }
    const expiresAtSec = Math.floor(expiresAtMs / 1000);
    const validAfter = BigInt(nowSec - CLOCK_SKEW_SEC);
    const validBefore = BigInt(expiresAtSec + SETTLEMENT_MARGIN_SEC);
    // Don't sign an already-expired authorization (it would revert on-chain with
    // AuthorizationExpired). This also rules out the validAfter >= validBefore
    // inversion, since validAfter < now < validBefore here.
    if (validBefore <= BigInt(nowSec)) {
      throw new X402Error(
        `challenge has already expired (expires_at ${challenge.expires_at}); not signing`,
        0,
      );
    }

    const auth: TransferAuthorization = {
      from: options.signer.address,
      to: pr.payTo as Address,
      value: BigInt(pr.maxAmountRequired),
      validAfter,
      validBefore,
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
