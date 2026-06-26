import { resolve } from "node:path";
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
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getEmail: mocks.getEmail,
    sendEmail: mocks.sendEmail,
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
// canonical sender (from_email) is the payee we must address the payment to,
// its recipient (to_email) is the payer From, and its message_id threads the
// authorization back under the challenge.
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
    });
    mocks.getEmail.mockResolvedValue(inboundChallengeEmail());
    mocks.sendEmail.mockResolvedValue({ data: { data: sendResult() } });
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("signs and sends interaction.json on the send path, threaded to the challenge", async () => {
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
    // no --from override. In-Reply-To threads under the challenge Message-Id.
    expect(call.body.to).toBe("payee@payee.example");
    expect(call.body.from).toBe("payer@payer.example");
    expect(call.body.in_reply_to).toBe("<challenge-msgid@payee.example>");
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

  it("omits in_reply_to when the inbound challenge has no Message-Id", async () => {
    mocks.getEmail.mockResolvedValueOnce({
      data: {
        data: {
          id: "inbound-challenge-1",
          message_id: null,
          from_email: "payee@payee.example",
          to_email: "payer@payer.example",
          recipient: "payer@payer.example",
          sender: "payee@payee.example",
        },
      },
    });
    await runPayEmailCommand([
      "--challenge",
      JSON.stringify(emailChallenge()),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);
    const call = mocks.sendEmail.mock.calls[0][0];
    // Threading is best-effort; association is by the interaction_id, so a
    // missing Message-Id must not block delivery.
    expect(call.body.in_reply_to).toBeUndefined();
    expect(call.body.to).toBe("payee@payee.example");
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

  it("warns on a replayed send so a deduped resend cannot look like a fresh delivery", async () => {
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
    // The exit code stays success and stdout JSON is unchanged for scripts, but
    // a loud stderr banner makes clear no fresh MX traffic was generated, so a
    // replayed resend is not mistaken for a delivered settlement.
    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain("idempotent replay");
    expect(result.stdout).toContain('"id": "sent-pay-email-1"');
  });

  it("does not fetch or send when signing fails (invalid challenge)", async () => {
    const result = await runPayEmailCommand([
      "--challenge",
      JSON.stringify({ interaction_id: "x", challenge_id: "y" }),
      "--in-reply-to",
      "inbound-challenge-1",
      "--private-key",
      TEST_KEY,
    ]);
    expect(result.exitCode).toBe(1);
    expect(mocks.getEmail).not.toHaveBeenCalled();
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
