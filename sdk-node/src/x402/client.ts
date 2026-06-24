/**
 * x402 agent-to-agent payments.
 *
 * `charge()` (payee) asks for a payment; `pay()` (payer) signs and settles it
 * with the customer's own key. The signing is local and non-custodial; the key
 * never leaves the caller. The server resolves the real payee address, verifies
 * every signed field against its own records, and enforces the spend policy, so
 * the SDK's job is just: derive the bound authorization, sign, and submit.
 */
import { randomUUID } from "node:crypto";
import type { Address } from "viem";
import {
  type BuiltPaymentStep,
  buildExactEvmPaymentPayload,
  buildPaymentStepEnvelope,
  buildPayoutRegistrationMessage,
  computePaymentValidityWindow,
  signInteractionPayment,
  type X402Network,
  type X402PaymentPayload,
  type X402Signer,
} from "./sign.js";

const CHAIN_IDS: Record<string, number> = {
  "base-sepolia": 84532,
  base: 8453,
};

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

/** The nonce binding the payer hashes into the EIP-3009 nonce. */
export interface X402NonceBinding {
  interaction_id: string;
  challenge_step_id: string;
  challenge_nonce: string;
}

/**
 * The challenge details carried inside an email-native challenge: what the
 * payer needs to sign and pay. Distinct from the synthetic `X402Challenge` in
 * that it has no top-level `id`/`amount`; everything is in the nested objects.
 */
export interface X402EmailChallengeDetails {
  payment_requirements: X402PaymentRequirements;
  nonce_binding: X402NonceBinding;
  expires_at: string;
}

/**
 * The result of issuing an email-native challenge (`createEmailChallenge`).
 * `interaction_id` is the real email thread id (`uuid@domain`) the payment is
 * bound to. Hand the whole object to the payer; the payer calls
 * `payEmailChallenge` with it to build the signed payment step.
 */
export interface X402EmailChallenge {
  interaction_id: string;
  challenge_id: string;
  challenge: X402EmailChallengeDetails;
}

export interface X402Receipt {
  id: string;
  status: string;
  settle_tx: string | null;
}

/** A registered payout address (read shape; mirrors the platform response). */
export interface X402PayoutAddress {
  id: string;
  address: string;
  network: string;
  label: string | null;
  is_default: boolean;
  verified_at: string | null;
}

/** The org's spend policy (read shape; also accepted by `setSpendPolicy`). */
export interface X402SpendPolicy {
  /** Kill-switch: when true, all outbound payments are refused. */
  paused: boolean;
  /** Per-payment cap in token base units, or null for no cap. */
  max_per_payment: string | null;
  /** Daily cap in token base units, or null for no cap. */
  max_per_day: string | null;
  /** Allowed payee org ids; null = any on-net payee, [] = deny all. */
  allowlist: string[] | null;
}

/** A payment the org's spend policy refused (read shape). */
export interface X402DeclinedPayment {
  id: string;
  challenge_id: string | null;
  counterparty_org: string | null;
  network: string;
  amount: string;
  reason: string;
  declined_at: string;
}

export interface X402ChargeInput {
  /**
   * Amount in token base units (USDC has 6 decimals, so "10000" = 0.01).
   * Provide exactly one of `amount` or `amountUsdc`.
   */
  amount?: string;
  /**
   * Amount as human USDC (e.g. "0.01"), converted to base units for you.
   * Provide exactly one of `amount` or `amountUsdc`.
   */
  amountUsdc?: string;
  /** Defaults to "base-sepolia". */
  network?: string;
  /** The org id allowed to pay this challenge (on-net binding). */
  payerOrg?: string;
  description?: string;
  /** A URL identifying the thing being paid for. */
  resource?: string;
  /** Seconds until the challenge expires (default 1h). */
  expiresIn?: number;
  /**
   * Optional idempotency key. Retrying `charge()` with the same key returns the
   * original challenge instead of creating a duplicate.
   */
  idempotencyKey?: string;
}

// `satisfies Record<keyof X402ChargeInput, true>` makes this a compile-time
// mirror of the interface: adding a field to X402ChargeInput without adding it
// here (or vice versa) is a type error, so the allow-set can't silently drift.
const CHARGE_INPUT_KEYS = {
  amount: true,
  amountUsdc: true,
  network: true,
  payerOrg: true,
  description: true,
  resource: true,
  expiresIn: true,
  idempotencyKey: true,
} satisfies Record<keyof X402ChargeInput, true>;

export interface X402EmailChargeInput {
  /** Your sending address (the payee / funds receiver). */
  from: string;
  /** The payer's email address the challenge is sent to. */
  to: string;
  /**
   * Amount in token base units (USDC has 6 decimals, so "10000" = 0.01).
   * Provide exactly one of `amount` or `amountUsdc`.
   */
  amount?: string;
  /**
   * Amount as human USDC (e.g. "0.01"), converted to base units for you.
   * Provide exactly one of `amount` or `amountUsdc`.
   */
  amountUsdc?: string;
  /** Defaults to "base-sepolia". */
  network?: string;
  description?: string;
  /** A URL identifying the thing being paid for. */
  resource?: string;
  /** Seconds until the challenge expires (default 1h). */
  expiresIn?: number;
  /**
   * Optional idempotency key. Retrying `createEmailChallenge()` with the same
   * key returns the original challenge without sending a second email.
   */
  idempotencyKey?: string;
}

const EMAIL_CHARGE_INPUT_KEYS = {
  from: true,
  to: true,
  amount: true,
  amountUsdc: true,
  network: true,
  description: true,
  resource: true,
  expiresIn: true,
  idempotencyKey: true,
} satisfies Record<keyof X402EmailChargeInput, true>;

// USDC has 6 decimals. Convert a human amount ("0.01") to base units ("10000")
// with string/BigInt math so there is no float rounding. Returns null on a
// non-positive, malformed, or over-precise (>6 decimals) value.
function usdcToBaseUnits(human: string): string | null {
  const trimmed = human.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 6) return null;
  const base = BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, "0"));
  return base > 0n ? base.toString() : null;
}

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
  validatePaymentRequirements(c.payment_requirements, bad);
}

type BadFn = (field: string) => never;

/** Validate the x402 PaymentRequirements shared by both challenge shapes. */
function validatePaymentRequirements(
  pr: X402PaymentRequirements | undefined,
  bad: BadFn,
): void {
  if (!pr) bad("payment_requirements");
  // Require a positive integer base-units string so the later BigInt()
  // conversion cannot throw a raw SyntaxError on a malformed value.
  if (!/^[1-9][0-9]{0,38}$/.test(pr.maxAmountRequired ?? "")) {
    bad(
      "payment_requirements.maxAmountRequired (expected a positive integer string in token base units)",
    );
  }
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

/**
 * Assert an email-native challenge is fully hydrated before signing, so a
 * missing field fails with a named X402Error instead of an opaque error
 * mid-sign. The interaction_id and the challenge step id (the nonce binding's
 * fields) drive both the bound nonce and the payment-step envelope, so they are
 * checked here.
 */
function validateEmailChallenge(c: X402EmailChallenge): void {
  const bad = (field: string): never => {
    throw new X402Error(`email challenge is missing or malformed: ${field}`, 0);
  };
  if (!c || typeof c !== "object") bad("email challenge");
  if (!c.interaction_id) bad("interaction_id");
  const ch = c.challenge;
  if (!ch || typeof ch !== "object") bad("challenge");
  if (!ch.expires_at) bad("challenge.expires_at");
  const nb = ch.nonce_binding;
  if (!nb?.interaction_id || !nb.challenge_step_id || !nb.challenge_nonce) {
    bad("challenge.nonce_binding");
  }
  // The envelope's interaction_id must agree with the binding's, or the platform
  // would re-derive a nonce that doesn't match the one we signed.
  if (nb.interaction_id !== c.interaction_id) {
    bad(
      "interaction_id (mismatch with challenge.nonce_binding.interaction_id)",
    );
  }
  validatePaymentRequirements(ch.payment_requirements, bad);
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
    init?: { signal?: AbortSignal; headers?: Record<string, string> },
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
          ...init?.headers,
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
    if (input.amount !== undefined && input.amountUsdc !== undefined) {
      throw new X402Error(
        "charge() takes exactly one of `amount` (base units) or `amountUsdc` (human USDC), not both",
        0,
      );
    }
    const amount =
      input.amountUsdc !== undefined
        ? usdcToBaseUnits(input.amountUsdc)
        : (input.amount ?? null);
    if (!amount || !/^[1-9][0-9]{0,38}$/.test(amount)) {
      throw new X402Error(
        'charge() requires `amount` as a positive integer string in token base units (e.g. "10000"), or `amountUsdc` as a positive USDC amount with at most 6 decimals (e.g. "0.01")',
        0,
      );
    }
    const body: Record<string, unknown> = {
      amount,
      network: input.network ?? "base-sepolia",
    };
    if (input.payerOrg) body.payer_org = input.payerOrg;
    if (input.description) body.description = input.description;
    if (input.resource) body.resource = input.resource;
    if (input.expiresIn !== undefined) body.expires_in = input.expiresIn;
    return this.#request<X402Challenge>("POST", "/v1/x402/challenges", body, {
      headers: input.idempotencyKey
        ? { "idempotency-key": input.idempotencyKey }
        : undefined,
    });
  }

  /**
   * Issue a payment challenge over an email thread (payee side). Sends the
   * challenge as an email from `from` to `to` and binds the payment to that
   * thread. Returns the challenge (including the real `interaction_id`); deliver
   * it to the payer, who calls `payEmailChallenge` to build the signed payment.
   *
   * Provide exactly one of `amount` (base units) or `amountUsdc` (human USDC).
   */
  async createEmailChallenge(
    input: X402EmailChargeInput,
  ): Promise<X402EmailChallenge> {
    for (const key of Object.keys(input)) {
      if (!(key in EMAIL_CHARGE_INPUT_KEYS)) {
        throw new X402Error(
          `unknown createEmailChallenge() option "${key}"; expected one of: ${Object.keys(EMAIL_CHARGE_INPUT_KEYS).join(", ")}`,
          0,
        );
      }
    }
    if (!input.from) {
      throw new X402Error("createEmailChallenge() requires `from`", 0);
    }
    if (!input.to) {
      throw new X402Error("createEmailChallenge() requires `to`", 0);
    }
    if (input.amount !== undefined && input.amountUsdc !== undefined) {
      throw new X402Error(
        "createEmailChallenge() takes exactly one of `amount` (base units) or `amountUsdc` (human USDC), not both",
        0,
      );
    }
    const amount =
      input.amountUsdc !== undefined
        ? usdcToBaseUnits(input.amountUsdc)
        : (input.amount ?? null);
    if (!amount || !/^[1-9][0-9]{0,38}$/.test(amount)) {
      throw new X402Error(
        'createEmailChallenge() requires `amount` as a positive integer string in token base units (e.g. "10000"), or `amountUsdc` as a positive USDC amount with at most 6 decimals (e.g. "0.01")',
        0,
      );
    }
    const body: Record<string, unknown> = {
      from: input.from,
      to: input.to,
      amount,
      network: input.network ?? "base-sepolia",
    };
    if (input.description) body.description = input.description;
    if (input.resource) body.resource = input.resource;
    if (input.expiresIn !== undefined) body.expires_in = input.expiresIn;
    return this.#request<X402EmailChallenge>(
      "POST",
      "/v1/x402/email-challenges",
      body,
      {
        headers: input.idempotencyKey
          ? { "idempotency-key": input.idempotencyKey }
          : undefined,
      },
    );
  }

  /**
   * Build the signed payment step for an email-native challenge (payer side).
   * Given a received `X402EmailChallenge` and the caller's signer, this derives
   * the interaction-bound authorization, signs it locally, and returns the
   * signed `interaction.json` payment-step envelope plus its canonical JSON
   * bytes. It does NOT send anything.
   *
   * The caller sends `result.json` back as an `interaction.json` attachment on a
   * reply to the challenge email (e.g. via the SDK's `send` / `reply`); the
   * platform reads the envelope from those exact bytes, re-derives the bound
   * nonce, and settles.
   */
  async payEmailChallenge(
    challenge: X402EmailChallenge,
    options: { signer: X402Signer },
  ): Promise<BuiltPaymentStep> {
    if (
      !options?.signer?.address ||
      typeof options.signer.signTypedData !== "function"
    ) {
      throw new X402Error(
        "payEmailChallenge() requires options.signer with { address, signTypedData } (e.g. a viem LocalAccount)",
        0,
      );
    }
    validateEmailChallenge(challenge);
    const details = challenge.challenge;
    const pr = details.payment_requirements;
    const network = pr.network;
    const chainId = CHAIN_IDS[network];
    if (chainId === undefined) {
      throw new X402Error(`unsupported network: ${network}`, 0);
    }
    if (pr.scheme !== "exact") {
      throw new X402Error(`unsupported payment scheme: ${pr.scheme}`, 0);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAtMs = Date.parse(details.expires_at);
    if (Number.isNaN(expiresAtMs)) {
      throw new X402Error(
        `challenge has an invalid expires_at: ${details.expires_at}`,
        0,
      );
    }
    const expiresAtSec = Math.floor(expiresAtMs / 1000);
    if (expiresAtSec <= nowSec) {
      throw new X402Error(
        `challenge has already expired (expires_at ${details.expires_at}); not signing`,
        0,
      );
    }
    let validAfter: bigint;
    let validBefore: bigint;
    try {
      ({ validAfter, validBefore } = computePaymentValidityWindow({
        challengeExpiresAtSec: expiresAtSec,
        nowSec,
      }));
    } catch (cause) {
      throw new X402Error(
        cause instanceof Error ? cause.message : String(cause),
        0,
        undefined,
        { cause },
      );
    }

    const { authorization, signature } = await signInteractionPayment({
      sign: (typedData) => options.signer.signTypedData(typedData),
      payer: options.signer.address,
      domain: {
        name: pr.extra.name,
        version: pr.extra.version,
        chainId,
        verifyingContract: pr.asset as Address,
      },
      payTo: pr.payTo as Address,
      amount: BigInt(pr.maxAmountRequired),
      nonceBinding: {
        interactionId: details.nonce_binding.interaction_id,
        challengeStepId: details.nonce_binding.challenge_step_id,
        challengeNonce: details.nonce_binding.challenge_nonce,
      },
      validAfter,
      validBefore,
    });

    const payment: X402PaymentPayload = buildExactEvmPaymentPayload({
      network: network as X402Network,
      authorization,
      signature,
    });

    // A fresh UUID identifies the payment step; prev_step_id binds it to the
    // challenge step so the platform threads the interaction correctly.
    return buildPaymentStepEnvelope({
      interactionId: challenge.interaction_id,
      stepId: randomUUID(),
      prevStepId: details.nonce_binding.challenge_step_id,
      payment,
    });
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

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAtMs = Date.parse(challenge.expires_at);
    if (Number.isNaN(expiresAtMs)) {
      throw new X402Error(
        `challenge has an invalid expires_at: ${challenge.expires_at}`,
        0,
      );
    }
    const expiresAtSec = Math.floor(expiresAtMs / 1000);
    // Refuse a challenge that's already past its expires_at. Check expires_at
    // itself, NOT validBefore (which carries the settlement margin), so a
    // challenge that expired within the last settlement margin is still caught.
    // This also rules out the validAfter >= validBefore inversion, since a
    // non-expired challenge has validAfter < now < expiresAtSec < validBefore.
    if (expiresAtSec <= nowSec) {
      throw new X402Error(
        `challenge has already expired (expires_at ${challenge.expires_at}); not signing`,
        0,
      );
    }
    let validAfter: bigint;
    let validBefore: bigint;
    try {
      ({ validAfter, validBefore } = computePaymentValidityWindow({
        challengeExpiresAtSec: expiresAtSec,
        nowSec,
      }));
    } catch (cause) {
      throw new X402Error(
        cause instanceof Error ? cause.message : String(cause),
        0,
        undefined,
        { cause },
      );
    }

    const { authorization, signature } = await signInteractionPayment({
      sign: (typedData) => options.signer.signTypedData(typedData),
      payer: options.signer.address,
      domain: {
        name: pr.extra.name,
        version: pr.extra.version,
        chainId,
        verifyingContract: pr.asset as Address,
      },
      payTo: pr.payTo as Address,
      amount: BigInt(pr.maxAmountRequired),
      nonceBinding: {
        interactionId: challenge.nonce_binding.interaction_id,
        challengeStepId: challenge.nonce_binding.challenge_step_id,
        challengeNonce: challenge.nonce_binding.challenge_nonce,
      },
      validAfter,
      validBefore,
    });

    return this.#request<X402Receipt>(
      "POST",
      `/v1/x402/challenges/${challenge.id}/pay`,
      {
        payment: buildExactEvmPaymentPayload({
          network: challenge.network as X402Network,
          authorization,
          signature,
        }),
      },
    );
  }

  /** Fetch a challenge by id (scoped to the challenger org that created it). */
  async getChallenge(id: string): Promise<X402Challenge> {
    if (!id) throw new X402Error("getChallenge() requires a challenge id", 0);
    return this.#request<X402Challenge>(
      "GET",
      `/v1/x402/challenges/${encodeURIComponent(id)}`,
    );
  }

  /** Resolve the caller's own organization id from the account endpoint. */
  async #resolveOrgId(): Promise<string> {
    const account = await this.#request<{ id?: string }>("GET", "/v1/account");
    if (!account?.id) {
      throw new X402Error(
        "could not resolve your organization id from /v1/account; pass { org } explicitly",
        0,
      );
    }
    return account.id;
  }

  /**
   * Register a payout address for your org (payee side). The signer proves
   * control of its own address with an org-bound `personal_sign`; the proven
   * address becomes (or updates to) the default payout destination for the
   * network. `charge()` resolves its `pay_to` from this directory, so a payee
   * must register before requesting payments.
   *
   * `org` is optional: when omitted it is resolved from your authenticated
   * account, so most callers never need to supply it.
   */
  async registerPayoutAddress(
    input: {
      org?: string;
      network?: string;
      issuedAt?: string;
      label?: string;
    },
    options: { signer: X402Signer },
  ): Promise<X402PayoutAddress> {
    if (typeof options?.signer?.signMessage !== "function") {
      throw new X402Error(
        "registerPayoutAddress() requires a signer with signMessage (e.g. a viem LocalAccount)",
        0,
      );
    }
    const org = input.org ?? (await this.#resolveOrgId());
    const network = input.network ?? "base-sepolia";
    const issuedAt = input.issuedAt ?? new Date().toISOString();
    const address = options.signer.address;
    const message = buildPayoutRegistrationMessage({
      org,
      address,
      network,
      issuedAt,
    });
    const signature = await options.signer.signMessage({ message });
    return this.#request<X402PayoutAddress>(
      "POST",
      "/v1/x402/payout-addresses",
      {
        address,
        network,
        signature,
        issued_at: issuedAt,
        ...(input.label !== undefined ? { label: input.label } : {}),
      },
    );
  }

  /** List your org's registered payout addresses. */
  async listPayoutAddresses(): Promise<X402PayoutAddress[]> {
    return this.#request<X402PayoutAddress[]>(
      "GET",
      "/v1/x402/payout-addresses",
    );
  }

  /**
   * List the most recent payments your org's spend policy declined (newest
   * first). Use this to see why an outbound payment was refused.
   */
  async listDeclinedPayments(): Promise<X402DeclinedPayment[]> {
    return this.#request<X402DeclinedPayment[]>(
      "GET",
      "/v1/x402/declined-payments",
    );
  }

  /** Read your org's spend policy (kill-switch + caps + allowlist). */
  async getSpendPolicy(): Promise<X402SpendPolicy> {
    return this.#request<X402SpendPolicy>("GET", "/v1/x402/spend-policy");
  }

  /**
   * Update your org's spend policy. The endpoint is a PUT, but the server
   * applies it as a merge: only the fields you include are changed and omitted
   * fields keep their current value, so a partial update can't silently reset
   * the kill-switch. Pass `null` to clear a cap.
   */
  async setSpendPolicy(
    update: Partial<X402SpendPolicy>,
  ): Promise<X402SpendPolicy> {
    return this.#request<X402SpendPolicy>(
      "PUT",
      "/v1/x402/spend-policy",
      update,
    );
  }
}

export function createX402Client(options: X402ClientOptions = {}): X402Client {
  return new X402Client(options);
}
