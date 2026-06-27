import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import type { SendMailResult } from "@primitivedotdev/api-core";
import {
  createX402Client,
  type X402EmailChallenge,
} from "@primitivedotdev/sdk/x402";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A well-known deterministic test key (viem's documented example key). The
// interaction-bound nonce derivation is deterministic, so signing the same
// challenge with the same key is byte-identical every time.
const TEST_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// A valid email-native challenge the payee would have issued. Mirrors the SDK's
// own client test fixture so `payEmailChallenge` accepts it.
function emailChallenge(): X402EmailChallenge {
  return {
    interaction_id: "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
    challenge_id: "22222222-2222-4222-8222-222222222222",
    challenge: {
      payment_requirements: {
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "10000",
        payTo: "0x1111111111111111111111111111111111111111",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: { name: "USDC", version: "2" },
      },
      nonce_binding: {
        interaction_id: "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
        challenge_step_id: "f00dface-0000-0000-0000-0000000000aa",
        challenge_nonce:
          "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    },
  };
}

describe("signEmailChallenge shared helper", () => {
  it("produces a byte-identical signed payment to pay-email-step's SDK path", async () => {
    // The validity window is derived from the wall clock, so freeze time to make
    // two independent signings comparable; the signature, nonce, and window are
    // then fully deterministic for a fixed challenge + key.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    try {
      const { signEmailChallenge, signerFromPrivateKey } = await import(
        "../../src/oclif/commands/payments-shared.js"
      );
      const challenge = emailChallenge();

      // The shared helper used by both pay-email and pay-email-step.
      const viaHelper = await signEmailChallenge({
        challenge,
        privateKey: TEST_KEY,
        resolvedApiBaseUrl: "https://api.example/v1",
      });

      // The exact SDK call pay-email-step makes directly, for the same challenge
      // and key.
      const client = createX402Client({ baseUrl: "https://api.example" });
      const signer = signerFromPrivateKey(TEST_KEY);
      const viaSdk = await client.payEmailChallenge(challenge, { signer });

      // The signed payment (signature + interaction-bound authorization,
      // including the derived nonce + validity window) must be byte-identical:
      // the two commands cannot produce divergent settleable payloads for the
      // same input. Only the freshly-minted envelope `step_id` differs by design
      // (a new UUID per build), so normalize that one field out of the envelope.
      expect(viaHelper.envelope.payload).toEqual(viaSdk.envelope.payload);
      expect({ ...viaHelper.envelope, step_id: "X" }).toEqual({
        ...viaSdk.envelope,
        step_id: "X",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("binds the locked normative nonce (vector unchanged)", async () => {
    const { signEmailChallenge } = await import(
      "../../src/oclif/commands/payments-shared.js"
    );
    const built = await signEmailChallenge({
      challenge: emailChallenge(),
      privateKey: TEST_KEY,
      resolvedApiBaseUrl: "https://api.example/v1",
    });
    expect(built.envelope.payload.payment.payload.authorization.nonce).toBe(
      "0xc955a08812ab83f9e25c92e5162267b913957c3cc8678de1cf1449f77b516c6e",
    );
  });
});

describe("interactionAttachment", () => {
  it("names the part interaction.json with application/json and the canonical bytes", async () => {
    const { interactionAttachment } = await import(
      "../../src/oclif/commands/payments-pay-email.js"
    );
    const built = { json: '{"hello":"world"}', envelope: {} } as never;
    const attachment = interactionAttachment(built);
    expect(attachment.filename).toBe("interaction.json");
    expect(attachment.content_type).toBe("application/json");
    expect(
      Buffer.from(attachment.content_base64, "base64").toString("utf8"),
    ).toBe('{"hello":"world"}');
  });
});

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getEmail: vi.fn(),
  sendEmail: vi.fn(),
  searchEmails: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getEmail: mocks.getEmail,
    sendEmail: mocks.sendEmail,
    searchEmails: mocks.searchEmails,
  };
});

vi.mock("../../src/oclif/api-client.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/oclif/api-client.js")>();
  return {
    ...actual,
    createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
  };
});

const CLI_ROOT = resolve(import.meta.dirname, "../..");

// The inbound challenge email the payer received. The payee issued it, so its
// canonical sender (from_email) is the payee we must address the payment to and
// its recipient (to_email) is the payer From. It carries a message_id, but the
// one-shot deliberately does NOT thread the send under it (that would trigger
// the send endpoint's parent-thread dedup and the payment would never settle).
function inboundChallengeEmail() {
  return {
    data: {
      data: {
        id: "inbound-challenge-1",
        message_id: "<challenge-msgid@payee.example>",
        from_email: "payee@payee.example",
        to_email: "payer@payer.example",
        recipient: "payer@payer.example",
        sender: "payee@payee.example",
        // Real inbound attachment metadata: the challenge member's archive entry
        // is `0_interaction.json` (the `<part_index>_<filename>` scheme), which
        // the auto-derive uses to locate the part inside the tarball.
        parsed: {
          status: "complete",
          attachments: [
            {
              filename: "interaction.json",
              tar_path: "0_interaction.json",
              part_index: 0,
              size_bytes: 768,
              content_type: "application/json",
            },
          ],
        },
      },
    },
  };
}

function sendResult(): SendMailResult {
  return {
    accepted: ["payee@payee.example"],
    client_idempotency_key: "pay-email-test",
    content_hash: "sha256:test",
    delivery_status: "delivered",
    id: "sent-pay-email-1",
    idempotent_replay: false,
    from: "payer@payer.example",
    queue_id: "queue-1",
    rejected: [],
    request_id: "req-1",
    status: "delivered",
  };
}

async function runPayEmailCommand(argv: string[]): Promise<{
  exitCode: NodeJS.Process["exitCode"];
  stdout: string;
  stderr: string;
}> {
  const { default: PaymentsPayEmailCommand } = await import(
    "../../src/oclif/commands/payments-pay-email.js"
  );
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdoutChunks.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  try {
    await PaymentsPayEmailCommand.run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

describe("payments pay-email (one-shot sign + send)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: { host: "api" } },
      auth: {
        source: "flag-or-env",
        apiKey: "k",
        apiBaseUrl: "https://api.example/v1",
        credentials: null,
      },
      baseUrlOverridden: false,
      requestConfig: { headers: undefined },
    });
    mocks.getEmail.mockResolvedValue(inboundChallengeEmail());
    mocks.sendEmail.mockResolvedValue({ data: { data: sendResult() } });
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("signs and sends interaction.json on the send path without threading the send", async () => {
    const result = await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);

    expect(result.exitCode).toBeUndefined();
    // The inbound challenge email is fetched to derive addressing + threading.
    expect(mocks.getEmail).toHaveBeenCalledTimes(1);
    expect(mocks.getEmail.mock.calls[0][0].path).toEqual({
      id: "inbound-challenge-1",
    });
    // Delivery goes via the send path (no reply-endpoint thread dedup), so the
    // payment is never swallowed as an idempotent replay.
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);

    const call = mocks.sendEmail.mock.calls[0][0];
    expect(call.client).toEqual({ host: "api" });
    expect(call.responseStyle).toBe("fields");
    // To = the payee that issued the challenge (the inbound's sender). From =
    // the payer the challenge was addressed to (the inbound's recipient), with
    // no --from override.
    expect(call.body.to).toBe("payee@payee.example");
    expect(call.body.from).toBe("payer@payer.example");
    // The send is NOT threaded under the challenge even though the inbound has a
    // Message-Id: setting in_reply_to would trigger the send endpoint's
    // parent-thread dedup (all x402 challenges to a payer thread together) and
    // the payment would never settle. The interaction associates by
    // interaction_id, so threading is unnecessary.
    expect(call.body.in_reply_to).toBeUndefined();
    expect(typeof call.body.subject).toBe("string");
    expect(call.body.subject.length).toBeGreaterThan(0);

    // Always carry a non-empty body even with no flags. With no --body the
    // default human-readable note is sent.
    expect(typeof call.body.body_text).toBe("string");
    expect(call.body.body_text.length).toBeGreaterThan(0);
    expect(call.body.body_text).toBe(
      "x402 payment authorization attached (interaction.json).",
    );

    // Exactly one attachment, named interaction.json, application/json, with the
    // canonical signed bytes (the inbound matcher requires exactly that).
    expect(call.body.attachments).toHaveLength(1);
    const att = call.body.attachments[0];
    expect(att.filename).toBe("interaction.json");
    expect(att.content_type).toBe("application/json");

    // The attached bytes are the signed x402.payment envelope: the right
    // protocol, the right interaction id, and the interaction-bound nonce (the
    // locked normative vector for this challenge). The signature + validity
    // window are time-derived, so the nonce is the stable settlement-critical
    // field to pin here.
    const attachedEnvelope = JSON.parse(
      Buffer.from(att.content_base64, "base64").toString("utf8"),
    );
    expect(attachedEnvelope.protocol).toBe("x402.payment");
    expect(attachedEnvelope.step).toBe("payment");
    expect(attachedEnvelope.interaction_id).toBe(
      "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
    );
    expect(attachedEnvelope.payload.payment.payload.authorization.nonce).toBe(
      "0xc955a08812ab83f9e25c92e5162267b913957c3cc8678de1cf1449f77b516c6e",
    );

    expect(result.stdout).toContain('"id": "sent-pay-email-1"');
  });

  it("passes a --from override through to the send From", async () => {
    await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
      "--from",
      "Payer <payer@payer.example>",
    ]);
    const call = mocks.sendEmail.mock.calls[0][0];
    // --from overrides the payer From derived from the inbound's recipient.
    expect(call.body.from).toBe("Payer <payer@payer.example>");
    // To is still the derived payee regardless of the From override.
    expect(call.body.to).toBe("payee@payee.example");
  });

  it("passes a --body override through as body_text", async () => {
    await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
      "--body",
      "Here is the signed authorization, thanks.",
    ]);
    const call = mocks.sendEmail.mock.calls[0][0];
    expect(call.body.body_text).toBe(
      "Here is the signed authorization, thanks.",
    );
    // The attachment is still sent alongside the custom body.
    expect(call.body.attachments).toHaveLength(1);
    expect(call.body.attachments[0].filename).toBe("interaction.json");
  });

  it("falls back to the default body when --body is blank or whitespace", async () => {
    await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
      "--body",
      "   ",
    ]);
    const call = mocks.sendEmail.mock.calls[0][0];
    // A blank/whitespace override must not slip through and produce an empty
    // body; the default note is used.
    expect(call.body.body_text).toBe(
      "x402 payment authorization attached (interaction.json).",
    );
  });

  it("never sets in_reply_to even when the inbound challenge has a Message-Id", async () => {
    // The default inbound fixture carries a Message-Id. The send must still omit
    // in_reply_to: threading under the challenge would re-trigger the send
    // endpoint's parent-thread dedup and the payment would never settle.
    // Addressing is still derived from the inbound, so To/From are unaffected.
    await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);
    const call = mocks.sendEmail.mock.calls[0][0];
    expect(call.body.in_reply_to).toBeUndefined();
    expect(call.body.to).toBe("payee@payee.example");
    expect(call.body.from).toBe("payer@payer.example");
  });

  it("--json emits both the interaction step and the send result", async () => {
    const result = await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
      "--json",
    ]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.interaction.protocol).toBeDefined();
    expect(parsed.sent.id).toBe("sent-pay-email-1");
  });

  it("fails (non-zero exit + banner) on a replayed send so a deduped resend cannot look like a settlement", async () => {
    mocks.sendEmail.mockResolvedValueOnce({
      data: {
        data: { ...sendResult(), idempotent_replay: true },
      },
    });
    const result = await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);
    // A deduped resend put no fresh MX traffic on the wire, so the
    // interaction.json was not re-delivered for settlement. For a payment
    // one-shot that is a hard failure, not advisory: exit non-zero so
    // automation halts instead of continuing the payment flow on a no-op. The
    // result is still printed (and a loud stderr banner explains the bypass).
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("idempotent replay");
    expect(result.stdout).toContain('"id": "sent-pay-email-1"');
  });

  it("flags idempotent_replay in --json output on a replayed send", async () => {
    mocks.sendEmail.mockResolvedValueOnce({
      data: {
        data: { ...sendResult(), idempotent_replay: true },
      },
    });
    const result = await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
      "--json",
    ]);
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout);
    // Scripted consumers get an explicit top-level replay flag, so automation
    // can detect the no-op without parsing the nested send result.
    expect(parsed.idempotent_replay).toBe(true);
    expect(parsed.sent.id).toBe("sent-pay-email-1");
  });

  it("does not send when signing fails (invalid challenge)", async () => {
    const result = await runPayEmailCommand([
      "--challenge",
      JSON.stringify({ interaction_id: "x", challenge_id: "y" }),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);
    expect(result.exitCode).toBe(1);
    // The inbound email is now fetched first (it is the addressing source and,
    // without an override, the challenge source), so getEmail may be called; but
    // a signing failure must still short-circuit before any send goes out.
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("surfaces a get-email error and does not send", async () => {
    mocks.getEmail.mockResolvedValueOnce({
      error: { error: { code: "not_found", message: "no such email" } },
    });
    const result = await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);
    expect(result.exitCode).toBe(1);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("surfaces a send error and sets a non-zero exit code", async () => {
    mocks.sendEmail.mockResolvedValueOnce({
      error: { error: { code: "boom", message: "delivery failed" } },
    });
    const result = await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);
    expect(result.exitCode).toBe(1);
  });
});

// --- Auto-derive-from-inbound path (the headline fix): pay-email with ONLY
// --in-reply-to, no --challenge / --challenge-file. ---

// Shared constants so the wire envelope (what the inbound attachment carries)
// and the equivalent --challenge object are byte-for-byte the same payment, and
// both sign to the same locked normative nonce vector.
const DERIVE_EXPIRES_AT = "2030-06-01T00:00:00.000Z";

// The challenge-step interaction.json the payer's inbound email carries: the
// WIRE ENVELOPE shape, with a different layout from the --challenge object.
function wireChallengeEnvelope(): Record<string, unknown> {
  return {
    interaction_version: 1,
    interaction_id: "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
    protocol: "x402.payment",
    protocol_version: 1,
    step: "challenge",
    step_id: "f00dface-0000-0000-0000-0000000000aa",
    prev_step_id: null,
    expires_at: DERIVE_EXPIRES_AT,
    payload: {
      challenge_nonce:
        "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
      payment_requirements: {
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "10000",
        payTo: "0x1111111111111111111111111111111111111111",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: { name: "USDC", version: "2" },
      },
    },
  };
}

// The SAME payment expressed as the payee-side challenge object the --challenge
// override accepts. Sharing every field with the wire envelope above is what
// lets us assert the two paths produce the identical signed authorization.
function equivalentChallengeObject(): X402EmailChallenge {
  return {
    interaction_id: "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
    challenge_id: "",
    challenge: {
      payment_requirements: {
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "10000",
        payTo: "0x1111111111111111111111111111111111111111",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: { name: "USDC", version: "2" },
      },
      nonce_binding: {
        interaction_id: "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
        challenge_step_id: "f00dface-0000-0000-0000-0000000000aa",
        challenge_nonce:
          "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
      },
      expires_at: DERIVE_EXPIRES_AT,
    },
  };
}

// Minimal ustar tar writer (one regular-file entry) so the command's real tar
// reader runs against genuine archive bytes.
function gzippedArchiveWith(name: string, content: string): Uint8Array {
  const enc = new TextEncoder();
  const body = enc.encode(content);
  const header = new Uint8Array(512);
  const octal = (v: number, w: number) =>
    `${v.toString(8).padStart(w - 1, "0")}\0`;
  header.set(enc.encode(name).subarray(0, 100), 0);
  header.set(enc.encode("0000644\0"), 100);
  header.set(enc.encode("0000000\0"), 108);
  header.set(enc.encode("0000000\0"), 116);
  header.set(enc.encode(octal(body.length, 12)), 124);
  header.set(enc.encode("00000000000\0"), 136);
  header.set(enc.encode("ustar\0"), 257);
  header.set(enc.encode("00"), 263);
  header[156] = "0".charCodeAt(0);
  for (let i = 148; i < 156; i++) header[i] = 0x20;
  let sum = 0;
  for (const b of header) sum += b;
  header.set(enc.encode(`${octal(sum, 7)} `), 148);
  const padded = new Uint8Array(Math.ceil(body.length / 512) * 512);
  padded.set(body, 0);
  const tar = new Uint8Array(header.length + padded.length + 1024);
  tar.set(header, 0);
  tar.set(padded, header.length);
  return gzipSync(tar);
}

describe("payments pay-email (auto-derive challenge from inbound)", () => {
  let originalFetch: typeof fetch;
  let originalTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: { host: "api" } },
      auth: {
        source: "flag-or-env",
        apiKey: "k",
        apiBaseUrl: "https://api.example/v1",
        credentials: null,
      },
      baseUrlOverridden: false,
      requestConfig: { headers: undefined },
    });
    mocks.getEmail.mockResolvedValue(inboundChallengeEmail());
    mocks.sendEmail.mockResolvedValue({ data: { data: sendResult() } });

    // The auto-derive path downloads the attachments tarball via the global
    // fetch (the network boundary we mock here).
    originalFetch = globalThis.fetch;
    // The real archive names the entry `0_interaction.json`, not a bare
    // `interaction.json`. Using the real name here is the regression guard: the
    // pre-fix derive matched the unprefixed name and would miss this.
    const gz = gzippedArchiveWith(
      "0_interaction.json",
      JSON.stringify(wireChallengeEnvelope()),
    );
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () =>
        gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength),
    })) as unknown as typeof fetch;

    // shouldDeriveChallenge() derives only when stdin is an interactive TTY (no
    // piped challenge). Force it so the no-challenge path is exercised.
    originalTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalTTY,
      configurable: true,
    });
    process.exitCode = undefined;
  });

  it("derives the challenge from the inbound attachment with no --challenge and produces the locked normative nonce", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    try {
      const result = await runPayEmailCommand([
        "--in-reply-to",
        "inbound-challenge-1",
        "--private-key",
        TEST_KEY,
      ]);
      expect(result.exitCode).toBeUndefined();
      // The tarball was fetched from the inbound email's attachments endpoint.
      const fetchMock = globalThis.fetch as unknown as {
        mock: { calls: unknown[][] };
      };
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.example/v1/emails/inbound-challenge-1/attachments.tar.gz",
      );
      // The signed attachment carries the locked normative nonce, proving the
      // reshaped wire envelope drove the exact same signing path.
      const call = mocks.sendEmail.mock.calls[0][0];
      const attached = JSON.parse(
        Buffer.from(call.body.attachments[0].content_base64, "base64").toString(
          "utf8",
        ),
      );
      expect(attached.payload.payment.payload.authorization.nonce).toBe(
        "0xc955a08812ab83f9e25c92e5162267b913957c3cc8678de1cf1449f77b516c6e",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("produces the SAME signed authorization as passing the equivalent --challenge object", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    try {
      // Auto-derived run (no --challenge).
      await runPayEmailCommand([
        "--in-reply-to",
        "inbound-challenge-1",
        "--private-key",
        TEST_KEY,
      ]);
      const derivedAttachment = JSON.parse(
        Buffer.from(
          mocks.sendEmail.mock.calls[0][0].body.attachments[0].content_base64,
          "base64",
        ).toString("utf8"),
      );

      mocks.sendEmail.mockClear();

      // Explicit --challenge run with the equivalent challenge object.
      await runPayEmailCommand([
        "--challenge",
        JSON.stringify(equivalentChallengeObject()),
        "--in-reply-to",
        "inbound-challenge-1",
        "--private-key",
        TEST_KEY,
      ]);
      const overrideAttachment = JSON.parse(
        Buffer.from(
          mocks.sendEmail.mock.calls[0][0].body.attachments[0].content_base64,
          "base64",
        ).toString("utf8"),
      );

      // The signed payment payload (authorization + signature + derived nonce)
      // must be byte-identical: deriving from the email attachment cannot produce
      // a different settleable authorization than the hand-built challenge. Only
      // the fresh per-build step_id differs by design.
      expect(derivedAttachment.payload).toEqual(overrideAttachment.payload);
      expect({ ...derivedAttachment, step_id: "X" }).toEqual({
        ...overrideAttachment,
        step_id: "X",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("the --challenge override skips the attachment download entirely", async () => {
    await runPayEmailCommand([
      "--challenge",
      JSON.stringify(equivalentChallengeObject()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);
    // With an explicit override the tarball is never fetched; only getEmail (for
    // addressing) runs against the network.
    const fetchMock = globalThis.fetch as unknown as {
      mock: { calls: unknown[][] };
    };
    expect(fetchMock.mock.calls).toHaveLength(0);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("derives in a non-interactive (non-TTY) process, the way CI / Docker run it", async () => {
    // Regression guard: derivation must NOT depend on an interactive TTY. In CI /
    // Docker stdin is not a TTY even though nothing is piped, so a TTY-gated
    // derive would skip the attachment download and hang on / mis-parse stdin.
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });
    const result = await runPayEmailCommand([
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);
    expect(result.exitCode).toBeUndefined();
    const fetchMock = globalThis.fetch as unknown as {
      mock: { calls: unknown[][] };
    };
    // The attachment WAS downloaded (derivation ran) despite no TTY.
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example/v1/emails/inbound-challenge-1/attachments.tar.gz",
    );
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("payments pay-email --wait-settle", () => {
  let originalFetch: typeof fetch;
  let originalTTY: boolean | undefined;

  // The settlement receipt the payee emails back: same interaction_id as the
  // payment we sent, a settlement step, and a settle_tx.
  function receiptEnvelope(): Record<string, unknown> {
    return {
      interaction_version: 1,
      interaction_id: "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
      protocol: "x402.payment",
      protocol_version: 1,
      step: "settled",
      step_id: "beadfeed-0000-0000-0000-0000000000bb",
      settle_tx: "0xfeedface",
      payload: { settle_tx: "0xfeedface" },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: { host: "api" } },
      auth: {
        source: "flag-or-env",
        apiKey: "k",
        apiBaseUrl: "https://api.example/v1",
        credentials: null,
      },
      baseUrlOverridden: false,
      requestConfig: { headers: undefined },
    });
    mocks.getEmail.mockResolvedValue(inboundChallengeEmail());
    mocks.sendEmail.mockResolvedValue({ data: { data: sendResult() } });
    // The settlement poll finds one inbound email from the payee.
    mocks.searchEmails.mockResolvedValue({
      data: {
        data: [
          { id: "settlement-email-1", received_at: "2030-01-01T00:00:01.000Z" },
        ],
        meta: { cursor: null },
      },
    });

    // fetch is used for BOTH the challenge attachment (on the inbound id) and the
    // receipt attachment (on the settlement email id); branch on the URL.
    originalFetch = globalThis.fetch;
    // Both archives use the real `0_interaction.json` entry name. The settlement
    // poll has no attachment metadata (it only has search rows), so it resolves
    // the receipt via the prefix-stripping fallback; the challenge derive uses
    // the email metadata's tar_path.
    const challengeGz = gzippedArchiveWith(
      "0_interaction.json",
      JSON.stringify(wireChallengeEnvelope()),
    );
    const receiptGz = gzippedArchiveWith(
      "0_interaction.json",
      JSON.stringify(receiptEnvelope()),
    );
    const toAb = (u: Uint8Array) =>
      u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
    globalThis.fetch = vi.fn(async (url: string) => ({
      ok: true,
      arrayBuffer: async () =>
        url.includes("settlement-email-1")
          ? toAb(receiptGz)
          : toAb(challengeGz),
    })) as unknown as typeof fetch;

    originalTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalTTY,
      configurable: true,
    });
    process.exitCode = undefined;
  });

  it("polls for the settlement interaction and surfaces the settle_tx", async () => {
    const result = await runPayEmailCommand([
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
      "--wait-settle",
      "--settle-interval",
      "1",
      "--settle-timeout",
      "30",
      "--json",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain("settle_tx: 0xfeedface");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.settlement.settle_tx).toBe("0xfeedface");
    expect(parsed.settlement.email_id).toBe("settlement-email-1");
  });

  it("exits non-zero and explains the async settlement when no receipt arrives in time", async () => {
    // No settlement email is ever found, so the poll times out. A 1s timeout
    // keeps the test fast while still exercising the timeout branch.
    mocks.searchEmails.mockResolvedValue({
      data: { data: [], meta: { cursor: null } },
    });
    const result = await runPayEmailCommand([
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
      "--wait-settle",
      "--settle-timeout",
      "1",
      "--settle-interval",
      "1",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "Timed out waiting for the x402 settlement interaction email",
    );
  });
});
