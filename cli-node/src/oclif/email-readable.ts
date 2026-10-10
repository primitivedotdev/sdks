import type { PrimitiveApiClient } from "@primitivedotdev/api-core";

type Client = PrimitiveApiClient["client"];

const security = [{ scheme: "bearer" as const, type: "http" as const }];

export type ReadableAttachment = {
  /** Sender-authored and untrusted. */
  filename: string | null;
  /** Sender-authored and untrusted. */
  content_type: string | null;
  size_bytes: number;
  part_index: number | null;
};

/**
 * The `data` of `GET /v1/emails/{id}/readable`. The base OpenAPI spec does
 * not describe the route yet, so the generated client has no type for it.
 */
export type EmailReadable = {
  id: string;
  thread_id: string | null;
  received_at: string;
  from: string;
  to: string;
  /** Sender-authored and untrusted. */
  subject: string | null;
  /** Sender-authored and untrusted. */
  preheader: string | null;
  parse_status: string | null;
  /**
   * Sender-authored and untrusted. Readable text with every link replaced by
   * a `[n]` marker; hidden content, layout and quoted reply history removed.
   */
  body_text: string;
  body_source: "html" | "text" | "none";
  body_chars: number;
  body_offset: number;
  /** Pass as `offset` to read the next page; null when nothing is left. */
  body_next_offset: number | null;
  body_incomplete: boolean;
  quoted_chars_removed: number;
  image_count: number;
  link_count: number;
  /** Present only when targets were asked for with `links`. */
  links?: { n: number; url: string }[];
  attachments: ReadableAttachment[];
};

export type ReadableQuery = {
  max_chars?: number;
  offset?: number;
  links?: string;
};

export type ReadableResult =
  | { kind: "ok"; data: EmailReadable }
  | { kind: "route_missing" }
  | { kind: "error"; error: unknown };

const LINKS = /^(?:all|\d+(?:,\d+)*)$/;

/** Whether a --links value is `all` or a comma list of link numbers. */
export function validLinksValue(value: string): boolean {
  return LINKS.test(value);
}

function errorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const inner = (body as { error?: unknown }).error;
  const source = inner && typeof inner === "object" ? inner : (body as object);
  const message = (source as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

/**
 * A deployment that does not serve the readable route answers 404 with a
 * message naming the route as not served, which is a capability answer
 * rather than a missing email.
 */
export function isReadableRouteMissing(
  status: number | undefined,
  body: unknown,
): boolean {
  return (
    status === 404 && errorMessage(body).includes("is not served by core-api")
  );
}

export async function getEmailReadable(
  client: Client,
  id: string,
  query: ReadableQuery,
): Promise<ReadableResult> {
  const result = (await client.get({
    security,
    url: "/emails/{id}/readable",
    path: { id },
    query,
    responseStyle: "fields",
  })) as { data?: unknown; error?: unknown; response?: Response };
  if (result.error !== undefined) {
    if (isReadableRouteMissing(result.response?.status, result.error))
      return { kind: "route_missing" };
    return { kind: "error", error: result.error };
  }
  const data = (result.data as { data?: unknown } | undefined)?.data;
  if (!data || typeof data !== "object")
    return {
      kind: "error",
      error: new Error("The API returned no readable email."),
    };
  return { kind: "ok", data: data as EmailReadable };
}
