import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  type EmailAnalysis,
  type EmailAuth,
  PrimitiveClient,
  type ReceivedEmail,
} from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(
  __dirname,
  "../../../test-fixtures/send-payloads/cases.json",
);

interface CanonicalInbound {
  id: string;
  event_id: string;
  received_at: string;
  sender: { address: string; name: string | null };
  reply_target: { address: string; name: string | null };
  received_by: string;
  received_by_all: string[];
  subject: string | null;
  reply_subject: string;
  forward_subject: string;
  text: string | null;
  thread: {
    message_id: string | null;
    in_reply_to: string[];
    references: string[];
  };
  raw_to_header: string;
  raw_date_header: string;
}

interface SendInputCase {
  from: string;
  to: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  in_reply_to?: string;
  references?: string[];
  wait?: boolean;
  wait_timeout_ms?: number;
  idempotency_key?: string;
}

interface ReplyInputCase {
  text?: string;
  html?: string;
  from?: string;
  wait?: boolean;
}

interface ForwardInputCase {
  to: string;
  body_text?: string;
  subject?: string;
  from?: string;
}

interface SendCase {
  name: string;
  input: SendInputCase;
  expected_body: Record<string, unknown>;
  expected_idempotency_key: string | null;
}

interface ReplyCase {
  name: string;
  input: ReplyInputCase;
  expected_path: string;
  expected_body: Record<string, unknown>;
  expected_idempotency_key: string | null;
}

interface ForwardCase {
  name: string;
  input: ForwardInputCase;
  expected_body_match: Record<string, unknown>;
  expected_body_text_contains: string[];
  expected_idempotency_key: string | null;
}

interface FixtureFile {
  canonical_inbound: CanonicalInbound;
  send: SendCase[];
  reply: ReplyCase[];
  forward: ForwardCase[];
}

const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as FixtureFile;

const TEST_AUTH: EmailAuth = {
  spf: "pass",
  dmarc: "pass",
  dmarcPolicy: "reject",
  dmarcFromDomain: "example.com",
  dmarcSpfAligned: true,
  dmarcDkimAligned: true,
  dmarcSpfStrict: false,
  dmarcDkimStrict: false,
  dkimSignatures: [],
};

const TEST_ANALYSIS: EmailAnalysis = {};

function buildReceivedEmail(c: CanonicalInbound): ReceivedEmail {
  return {
    id: c.id,
    eventId: c.event_id,
    receivedAt: c.received_at,
    sender: c.sender,
    replyTarget: c.reply_target,
    receivedBy: c.received_by,
    receivedByAll: [...c.received_by_all],
    subject: c.subject,
    replySubject: c.reply_subject,
    forwardSubject: c.forward_subject,
    text: c.text,
    thread: {
      messageId: c.thread.message_id,
      inReplyTo: [...c.thread.in_reply_to],
      references: [...c.thread.references],
    },
    attachments: [],
    auth: TEST_AUTH,
    analysis: TEST_ANALYSIS,
    raw: {
      id: c.event_id,
      event: "email.received",
      version: "2025-12-14",
      delivery: {
        endpoint_id: "endpoint-1",
        attempt: 1,
        attempted_at: c.received_at,
      },
      email: {
        id: c.id,
        received_at: c.received_at,
        smtp: {
          helo: null,
          mail_from: "bounce@example.com",
          rcpt_to: [c.received_by],
        },
        headers: {
          message_id: c.thread.message_id,
          subject: c.subject,
          from: c.sender.name
            ? `${c.sender.name} <${c.sender.address}>`
            : c.sender.address,
          to: c.raw_to_header,
          date: c.raw_date_header,
        },
        content: {
          raw: {
            included: false,
            reason_code: "size_exceeded",
            max_inline_bytes: 0,
            size_bytes: 0,
            sha256: "0".repeat(64),
          },
          download: {
            url: "https://example.test/raw.eml",
            expires_at: "2026-01-01T01:00:00.000Z",
          },
        },
        parsed: {
          status: "complete",
          error: null,
          body_text: c.text,
          body_html: null,
          reply_to: [],
          cc: [],
          bcc: [],
          in_reply_to: [...c.thread.in_reply_to],
          references: [...c.thread.references],
          attachments: [],
          attachments_download_url: null,
        },
        analysis: TEST_ANALYSIS,
        auth: TEST_AUTH,
      },
    },
  };
}

const SUCCESS_RESPONSE = {
  success: true,
  data: {
    id: "sent-x",
    status: "submitted_to_agent",
    queue_id: null,
    accepted: [],
    rejected: [],
    client_idempotency_key: "auto",
    request_id: "req",
    content_hash: "h",
    idempotent_replay: false,
  },
};

function captureFetch(): {
  fetch: typeof fetch;
  captured: {
    path: string | null;
    body: Record<string, unknown> | null;
    idempotencyKey: string | null;
  };
} {
  const captured: {
    path: string | null;
    body: Record<string, unknown> | null;
    idempotencyKey: string | null;
  } = { path: null, body: null, idempotencyKey: null };
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const request = input as Request;
    captured.path = new URL(request.url).pathname;
    captured.body = (await request.json()) as Record<string, unknown>;
    captured.idempotencyKey = request.headers.get("idempotency-key");
    return new Response(JSON.stringify(SUCCESS_RESPONSE), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetch: fetchMock, captured };
}

function buildClient(fetchImpl: typeof fetch): PrimitiveClient {
  return new PrimitiveClient({
    apiKey: "prim_test",
    baseUrl: "https://example.test/api/v1",
    fetch: fetchImpl,
  });
}

describe("shared send/reply/forward payloads", () => {
  for (const testCase of FIXTURE.send) {
    it(`send: ${testCase.name}`, async () => {
      const { fetch: fetchImpl, captured } = captureFetch();
      const client = buildClient(fetchImpl);

      const thread =
        testCase.input.in_reply_to !== undefined ||
        testCase.input.references !== undefined
          ? {
              ...(testCase.input.in_reply_to
                ? { inReplyTo: testCase.input.in_reply_to }
                : {}),
              ...(testCase.input.references
                ? { references: testCase.input.references }
                : {}),
            }
          : undefined;

      await client.send({
        from: testCase.input.from,
        to: testCase.input.to,
        subject: testCase.input.subject,
        ...(testCase.input.body_text !== undefined
          ? { bodyText: testCase.input.body_text }
          : {}),
        ...(testCase.input.body_html !== undefined
          ? { bodyHtml: testCase.input.body_html }
          : {}),
        ...(thread ? { thread } : {}),
        ...(testCase.input.wait !== undefined
          ? { wait: testCase.input.wait }
          : {}),
        ...(testCase.input.wait_timeout_ms !== undefined
          ? { waitTimeoutMs: testCase.input.wait_timeout_ms }
          : {}),
        ...(testCase.input.idempotency_key !== undefined
          ? { idempotencyKey: testCase.input.idempotency_key }
          : {}),
      });

      expect(captured.body).toEqual(testCase.expected_body);
      expect(captured.idempotencyKey).toBe(testCase.expected_idempotency_key);
    });
  }

  for (const testCase of FIXTURE.reply) {
    it(`reply: ${testCase.name}`, async () => {
      const { fetch: fetchImpl, captured } = captureFetch();
      const client = buildClient(fetchImpl);
      const email = buildReceivedEmail(FIXTURE.canonical_inbound);

      await client.reply(email, {
        ...(testCase.input.text !== undefined
          ? { text: testCase.input.text }
          : {}),
        ...(testCase.input.html !== undefined
          ? { html: testCase.input.html }
          : {}),
        ...(testCase.input.from !== undefined
          ? { from: testCase.input.from }
          : {}),
        ...(testCase.input.wait !== undefined
          ? { wait: testCase.input.wait }
          : {}),
      });

      // Path matters now: reply hits /emails/{id}/reply, not /send-mail.
      // A regression that wires reply back to send-mail would silently
      // build the wrong shape; the path assertion catches it before the
      // body assertion can give a misleading diff.
      expect(captured.path).toBe(`/api/v1${testCase.expected_path}`);
      expect(captured.body).toEqual(testCase.expected_body);
      expect(captured.idempotencyKey).toBe(testCase.expected_idempotency_key);
    });
  }

  for (const testCase of FIXTURE.forward) {
    it(`forward: ${testCase.name}`, async () => {
      const { fetch: fetchImpl, captured } = captureFetch();
      const client = buildClient(fetchImpl);
      const email = buildReceivedEmail(FIXTURE.canonical_inbound);

      await client.forward(email, {
        to: testCase.input.to,
        ...(testCase.input.body_text !== undefined
          ? { bodyText: testCase.input.body_text }
          : {}),
        ...(testCase.input.subject !== undefined
          ? { subject: testCase.input.subject }
          : {}),
        ...(testCase.input.from !== undefined
          ? { from: testCase.input.from }
          : {}),
      });

      expect(captured.body, testCase.name).toMatchObject(
        testCase.expected_body_match,
      );
      expect(typeof captured.body?.body_text, testCase.name).toBe("string");
      const bodyText = String(captured.body?.body_text ?? "");
      for (const fragment of testCase.expected_body_text_contains) {
        expect(bodyText, testCase.name).toContain(fragment);
      }
      expect(captured.idempotencyKey).toBe(testCase.expected_idempotency_key);
    });
  }
});
