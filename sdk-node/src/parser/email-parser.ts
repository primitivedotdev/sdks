import type { AddressObject, ParsedMail } from "mailparser";

async function loadMailparser() {
  return import("mailparser");
}

// Mailparser address types for header parsing
interface MailparserAddress {
  address?: string;
  name?: string;
}

export interface ParsedEmail {
  from: string;
  to: string;
  subject: string | undefined;
  text: string | undefined;
  html: string | undefined;
  headers: Record<string, string | string[]>;
  messageId: string | undefined;
  date: Date | undefined;
}

/**
 * Parse a raw .eml file into structured data
 * Uses mailparser library for robust email parsing
 */
export async function parseEmail(emlRaw: string): Promise<ParsedEmail> {
  const { simpleParser } = await loadMailparser();
  const parsed: ParsedMail = await simpleParser(emlRaw);

  // Extract headers as a plain object
  const headers: Record<string, string | string[]> = {};
  parsed.headers.forEach((value, key) => {
    headers[key] = headerValueToString(value);
  });

  // Safely get text from address (AddressObject from mailparser)
  const getAddressText = (
    addr: AddressObject | AddressObject[] | undefined,
  ): string => {
    if (!addr) return "";
    if (Array.isArray(addr)) {
      return addr.map((entry) => entry.text || "").filter(Boolean).join(", ");
    }
    return addr.text || "";
  };

  return {
    from: getAddressText(parsed.from),
    to: getAddressText(parsed.to),
    subject: parsed.subject,
    text: parsed.text,
    html: parsed.html ? String(parsed.html) : undefined,
    headers,
    messageId: parsed.messageId,
    date: parsed.date,
  };
}

function headerValueToString(value: unknown): string | string[] {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === "string")) {
      return value as string[];
    }

    return value
      .map((entry) => structuredHeaderToString(entry))
      .filter((entry) => entry.length > 0)
      .join(", ");
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    return structuredHeaderToString(value);
  }

  return String(value);
}

function structuredHeaderToString(value: unknown): string {
  if (!value || typeof value !== "object") {
    return String(value ?? "");
  }

  if ("text" in value && typeof value.text === "string") {
    return value.text;
  }

  if ("address" in value || "name" in value) {
    const address = (value as MailparserAddress).address;
    return typeof address === "string" ? address : "";
  }

  if ("value" in value) {
    const nested = value.value;

    if (Array.isArray(nested)) {
      return nested
        .map((entry) =>
          typeof entry === "string"
            ? entry
            : entry.address || structuredHeaderToString(entry),
        )
        .filter((entry) => entry.length > 0)
        .join(", ");
    }

    if (typeof nested === "string") {
      return nested;
    }
  }

  return JSON.stringify(value);
}
