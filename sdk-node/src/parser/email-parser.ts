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
    if (typeof value === "string") {
      headers[key] = value;
    } else if (
      Array.isArray(value) &&
      value.every((v) => typeof v === "string")
    ) {
      headers[key] = value as string[];
    } else if (value instanceof Date) {
      headers[key] = value.toISOString();
    } else if (value && typeof value === "object") {
      // mailparser returns objects for structured headers
      // Extract useful string representation instead of [object Object]
      if ("text" in value && typeof value.text === "string") {
        headers[key] = value.text;
      } else if ("value" in value) {
        if (Array.isArray(value.value)) {
          // Address list
          headers[key] = value.value
            .map((v: MailparserAddress | string) =>
              typeof v === "string" ? v : v.address || "",
            )
            .join(", ");
        } else if (typeof value.value === "string") {
          // Simple value (like content-type)
          headers[key] = value.value;
        } else {
          // Complex - JSON stringify
          headers[key] = JSON.stringify(value);
        }
      } else {
        // Unknown object structure - JSON stringify
        headers[key] = JSON.stringify(value);
      }
    } else {
      // Convert any other type to string
      headers[key] = String(value);
    }
  });

  // Safely get text from address (AddressObject from mailparser)
  const getAddressText = (
    addr: AddressObject | AddressObject[] | undefined,
  ): string => {
    if (!addr) return "";
    if (Array.isArray(addr)) {
      return addr[0]?.text || "";
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
