import addressparser from "nodemailer/lib/addressparser/index.js";
import type {
  EmailAnalysis,
  EmailAuth,
  EmailReceivedEvent,
  WebhookAttachment,
} from "../types.js";

export interface ReceivedEmailAddress {
  address: string;
  name: string | null;
}

export interface ReceivedEmailThread {
  messageId: string | null;
  inReplyTo: string[];
  references: string[];
}

export interface ReceivedEmail {
  id: string;
  eventId: string;
  receivedAt: string;
  sender: ReceivedEmailAddress;
  replyTarget: ReceivedEmailAddress;
  receivedBy: string;
  receivedByAll: string[];
  subject: string | null;
  replySubject: string;
  forwardSubject: string;
  text: string | null;
  thread: ReceivedEmailThread;
  attachments: WebhookAttachment[];
  auth: EmailAuth;
  analysis: EmailAnalysis;
  raw: EmailReceivedEvent;
}

export function normalizeReceivedEmail(
  event: EmailReceivedEvent,
): ReceivedEmail {
  const sender = parseHeaderAddress(event.email.headers.from) ?? {
    address: event.email.smtp.mail_from.trim().toLowerCase(),
    name: null,
  };

  const replyTarget =
    firstStructuredAddress(event.email.parsed.reply_to) ?? sender;
  const subject = event.email.headers.subject ?? null;
  const references = event.email.parsed.references ?? [];
  const messageId = event.email.headers.message_id ?? null;

  return {
    id: event.email.id,
    eventId: event.id,
    receivedAt: event.email.received_at,
    sender,
    replyTarget,
    receivedBy: event.email.smtp.rcpt_to[0],
    receivedByAll: [...event.email.smtp.rcpt_to],
    subject,
    replySubject: buildReplySubject(subject),
    forwardSubject: buildForwardSubject(subject),
    text: event.email.parsed.body_text ?? null,
    thread: {
      messageId,
      inReplyTo: event.email.parsed.in_reply_to ?? [],
      references,
    },
    attachments: event.email.parsed.attachments ?? [],
    auth: event.email.auth,
    analysis: event.email.analysis,
    raw: event,
  };
}

export function buildReplySubject(subject: string | null | undefined): string {
  const trimmed = subject?.trim() ?? "";
  if (trimmed.length === 0) {
    return "Re:";
  }
  return /^re\s*:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function buildForwardSubject(
  subject: string | null | undefined,
): string {
  const trimmed = subject?.trim() ?? "";
  if (trimmed.length === 0) {
    return "Fwd:";
  }
  return /^(fwd?|fw)\s*:/i.test(trimmed) ? trimmed : `Fwd: ${trimmed}`;
}

export function formatAddress(address: ReceivedEmailAddress): string {
  return address.name
    ? `${address.name} <${address.address}>`
    : address.address;
}

function firstStructuredAddress(
  addresses: { address: string; name?: string | null }[] | null | undefined,
): ReceivedEmailAddress | null {
  const address = addresses?.[0];
  if (!address) {
    return null;
  }

  return {
    address: address.address.trim().toLowerCase(),
    name: address.name ?? null,
  };
}

function parseHeaderAddress(value: string): ReceivedEmailAddress | null {
  const parsed = addressparser(value).find(
    (entry) => typeof entry.address === "string",
  );
  if (!parsed?.address) {
    return null;
  }

  return {
    address: parsed.address.trim().toLowerCase(),
    name: parsed.name?.trim() || null,
  };
}
