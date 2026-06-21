// Shared helpers for the `primitive org secrets` commands. The org-secrets
// endpoints (`/v1/org/secrets`) are not on the generated API client yet, so
// these commands call them with raw fetch, mirroring `domains-zone-file`.

import { extractErrorPayload } from "../api-command.js";

export function orgSecretsUrl(baseUrl: string, key?: string): string {
  const base = `${baseUrl.replace(/\/$/, "")}/org/secrets`;
  return key ? `${base}/${encodeURIComponent(key)}` : base;
}

export function orgSecretsAuthHeaders(
  requestHeaders: Record<string, string> | undefined,
  apiKey: string | undefined,
): Record<string, string> {
  return {
    ...(requestHeaders ?? {}),
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  };
}

// Best-effort extraction of an error body from a non-2xx response. JSON bodies
// pass through; anything else collapses to a synthetic http_error envelope so
// the shared writeErrorWithHints surface always has something to print.
export async function orgSecretsErrorPayload(
  response: Response,
): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({
      code: "http_error",
      message: `HTTP ${response.status} ${response.statusText}`.trim(),
    }));
  }
  const text = await response.text().catch(() => "");
  return {
    code: "http_error",
    message:
      text.trim() || `HTTP ${response.status} ${response.statusText}`.trim(),
  };
}

export type OrgSecretsOp =
  | { kind: "list" }
  | { kind: "set"; key: string; value: string }
  | { kind: "remove"; key: string };

export type OrgSecretsOutcome =
  | { kind: "ok"; data: unknown }
  | { kind: "error"; payload: unknown };

// Core request orchestration, factored out of the commands so it can be driven
// with a fake fetch in tests. Returns the unwrapped data on success (list ->
// items[], set -> the upserted row, remove -> null), or a normalized error
// payload (transport error or non-2xx response) otherwise.
export async function runOrgSecretsRequest(
  fetchImpl: typeof fetch,
  baseUrl: string,
  headers: Record<string, string>,
  op: OrgSecretsOp,
): Promise<OrgSecretsOutcome> {
  const url =
    op.kind === "remove"
      ? orgSecretsUrl(baseUrl, op.key)
      : orgSecretsUrl(baseUrl);
  const init: RequestInit =
    op.kind === "set"
      ? {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ key: op.key, value: op.value }),
        }
      : op.kind === "remove"
        ? { method: "DELETE", headers }
        : { headers };

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    return { kind: "error", payload: extractErrorPayload(error) };
  }

  if (!response.ok) {
    return {
      kind: "error",
      payload: extractErrorPayload(await orgSecretsErrorPayload(response)),
    };
  }
  if (op.kind === "remove") return { kind: "ok", data: null };

  // `data` is either `{ items }` (list) or the upserted row (set); keep it
  // `unknown` and narrow only where we read the list shape.
  const body = (await response.json().catch(() => ({}))) as { data?: unknown };
  if (op.kind === "list") {
    const data = body.data as { items?: unknown[] } | undefined;
    return { kind: "ok", data: data?.items ?? [] };
  }
  return { kind: "ok", data: body.data ?? {} };
}
