import type { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { fetchEmailSearchPage, sleep } from "./emails-poll.js";
import { fetchInteractionJsonBytes } from "./payments-email-challenge.js";

// Waiting for the ASYNC settlement of an email-native x402 payment.
//
// Sending the signed `interaction.json` (what `pay-email` does) only puts the
// payment on the wire. Settlement happens on-chain afterward, and the payee
// emails the payer a FOLLOW-UP x402 settlement interaction once it lands. So
// `--wait` (which confirms SMTP delivery of the payment, at most) cannot tell
// you the payment settled or surface the `settle_tx`. That arrives in the later
// inbound interaction email.
//
// This module polls the inbox for that settlement email and surfaces it. The
// match is deterministic on the one field guaranteed to be on the wire: the
// receipt's `interaction.json` carries the SAME `interaction_id` as the payment
// we sent, and is NOT the `challenge` step the payer originally received nor the
// `payment` step the payer itself sent. We therefore match by interaction_id +
// "later step", then print the whole receipt envelope so the caller can read the
// settlement details verbatim. `settle_tx` is additionally surfaced on a
// best-effort basis when the receipt carries a field of that name; the full
// envelope is always printed so nothing is hidden by a heuristic.

/** The human-readable notice describing the async-settlement model. */
export const settlementWaitNotice =
  "Note: the payment has been SENT, but x402 settlement is asynchronous. --wait only confirms email delivery (SMTP 250), not on-chain settlement. The settle_tx hash arrives in a follow-up x402 settlement interaction email from the payee. Use --wait-settle to poll for it.";

/** The steps a payer has already seen / sent, so a matching later step is the receipt. */
const NON_RECEIPT_STEPS = new Set(["challenge", "payment"]);

export interface SettlementReceipt {
  /** The inbound settlement email's id. */
  emailId: string;
  /** The parsed receipt interaction.json envelope (printed verbatim). */
  envelope: Record<string, unknown>;
  /** The on-chain settlement tx hash, when the receipt carries one. */
  settleTx: string | null;
}

/**
 * Best-effort extraction of a `settle_tx` from a receipt envelope. The exact
 * receipt wire shape is owned by the platform and not pinned in the SDK, so we
 * do not assert a rigid schema: we look for a `settle_tx` string at the top
 * level or one level into `payload` (the two places interaction envelopes carry
 * step data). Returns null when absent; the caller always prints the full
 * envelope regardless, so a miss never hides data.
 */
export function extractSettleTx(
  envelope: Record<string, unknown>,
): string | null {
  const top = envelope.settle_tx;
  if (typeof top === "string" && top) return top;
  const payload = envelope.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const nested = (payload as Record<string, unknown>).settle_tx;
    if (typeof nested === "string" && nested) return nested;
  }
  return null;
}

/**
 * Parse interaction.json bytes into an envelope object, or null when the bytes
 * are not a JSON object (so a non-interaction attachment is simply skipped).
 */
export function parseInteractionEnvelope(
  bytes: Uint8Array,
): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

/**
 * True when a downloaded interaction.json envelope is the settlement receipt for
 * the interaction we paid: same `interaction_id`, and a step the payer has not
 * already produced/received (i.e. not `challenge` / `payment`). Matching on the
 * confirmed interaction_id keeps this correct without depending on the exact
 * receipt step name, which the platform owns.
 */
export function isSettlementReceiptFor(
  envelope: Record<string, unknown>,
  interactionId: string,
): boolean {
  if (envelope.interaction_id !== interactionId) return false;
  const step = envelope.step;
  if (typeof step === "string" && NON_RECEIPT_STEPS.has(step)) return false;
  return true;
}

/**
 * Poll the inbox for the x402 settlement interaction email that answers the
 * payment we just sent, and return it once found. Returns null on timeout.
 *
 * Searches inbound mail from the payee (with attachments) received since the
 * send, downloads each candidate's interaction.json, and matches it by
 * interaction_id via {@link isSettlementReceiptFor}. Network access is via the
 * injected api client (search) plus a plain fetch for the attachment archive,
 * mirroring how the rest of the payments surface reads attachments; `fetchImpl`
 * is injectable for tests.
 */
export async function pollForSettlementInteraction(params: {
  apiClient: PrimitiveApiClient;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  /** The interaction_id of the payment we sent (built.envelope.interaction_id). */
  interactionId: string;
  /** The payee address the settlement email comes from. */
  payeeFrom: string;
  /** ISO-8601 lower bound; only consider mail received at/after this. */
  since: string;
  /** Total seconds to poll before giving up; 0 waits forever. */
  timeoutSeconds: number;
  /** Seconds between polls. */
  intervalSeconds: number;
  fetchImpl?: typeof fetch;
}): Promise<SettlementReceipt | null> {
  const deadline =
    params.timeoutSeconds === 0
      ? null
      : Date.now() + params.timeoutSeconds * 1000;
  const checked = new Set<string>();

  while (deadline === null || Date.now() < deadline) {
    // Drain ALL pages each poll, not just the first 50. The search sorts
    // received_at_asc, so a fresh receipt can land on a later page when many
    // attachment-bearing emails from the payee arrive after `since`; reading only
    // page one would loop over the same oldest rows and time out while the actual
    // receipt sits beyond the page boundary. We re-scan from `since` each poll
    // (rather than persisting the cursor) so a transiently-skipped email is
    // retried; the `checked` set keeps already-read rows from being re-fetched.
    let cursor: string | null = null;
    let receipt: SettlementReceipt | null = null;
    let drained = false;
    while (!drained) {
      const page = await fetchEmailSearchPage({
        apiClient: params.apiClient,
        cursor,
        filters: { from: params.payeeFrom, hasAttachment: true },
        pageSize: 50,
        since: params.since,
      });
      if (!page.ok) break;

      for (const row of page.rows) {
        if (checked.has(row.id)) continue;
        let bytes: Uint8Array | null;
        try {
          bytes = await fetchInteractionJsonBytes({
            baseUrl: params.baseUrl,
            emailId: row.id,
            apiKey: params.apiKey,
            headers: params.headers,
            fetchImpl: params.fetchImpl,
          });
        } catch {
          // The settlement email can be searchable before its attachment archive
          // is ready, and a single fetch/gunzip can fail transiently. Do NOT mark
          // it checked: leave it for a later poll so a transient miss within the
          // timeout does not become a permanent skip.
          continue;
        }
        // Only now is the email definitively read; record it so we don't refetch
        // a no-interaction.json email every poll.
        checked.add(row.id);
        if (!bytes) continue;
        const envelope = parseInteractionEnvelope(bytes);
        if (!envelope) continue;
        if (isSettlementReceiptFor(envelope, params.interactionId)) {
          receipt = {
            emailId: row.id,
            envelope,
            settleTx: extractSettleTx(envelope),
          };
          break;
        }
      }

      if (receipt) break;
      // Advance to the next page; stop when there is no further cursor or the
      // page came back empty (no more results in this window).
      const nextCursor = page.cursor;
      if (!nextCursor || nextCursor === cursor || page.rows.length === 0) {
        drained = true;
      } else {
        cursor = nextCursor;
      }
    }

    if (receipt) return receipt;
    if (deadline !== null && Date.now() >= deadline) break;
    await sleep(params.intervalSeconds * 1000);
  }

  return null;
}
