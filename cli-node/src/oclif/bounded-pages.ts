type PageEnvelope = {
  data?: unknown;
  meta?: { cursor?: string | null; [key: string]: unknown };
  [key: string]: unknown;
};

/** Read a bounded window, preserving the last page's metadata and errors. */
export async function fetchBoundedPages<
  T extends { data?: unknown; error?: unknown },
>(options: {
  wanted: number;
  maximum: number;
  cursor: string | undefined;
  call: (limit: number, cursor: string | undefined) => Promise<T>;
}): Promise<{ result: T; envelope?: PageEnvelope; note?: string }> {
  const { wanted, maximum, call } = options;
  const rows: unknown[] = [];
  const seen = new Set<string | undefined>([options.cursor]);
  let cursor = options.cursor;
  let merged: PageEnvelope = {};
  const budget = Math.ceil(wanted / maximum) + 20;
  for (let requests = 1; ; requests += 1) {
    const result = await call(Math.min(maximum, wanted - rows.length), cursor);
    if (result.error) return { result };
    const envelope = result.data as PageEnvelope | undefined;
    rows.push(...(Array.isArray(envelope?.data) ? envelope.data : []));
    const previousWarnings = merged.warnings;
    // Count availability is a snapshot: omitted fields must not survive a page.
    const previousMeta = { ...merged.meta };
    delete previousMeta.total;
    delete previousMeta.total_capped;
    delete previousMeta.total_unavailable;
    merged = {
      ...merged,
      ...envelope,
      meta: { ...previousMeta, ...envelope?.meta },
    };
    if (Array.isArray(previousWarnings) && Array.isArray(envelope?.warnings))
      merged.warnings = [...previousWarnings, ...envelope.warnings];
    const next = envelope?.meta?.cursor ?? undefined;
    const repeated = Boolean(next) && seen.has(next);
    const bounded = Boolean(next) && rows.length < wanted && requests >= budget;
    if (!next || repeated || rows.length >= wanted || bounded) {
      const note = repeated
        ? `Stopped because the server repeated a cursor after ${requests} requests; more may remain. Continue with --cursor ${next}.`
        : bounded
          ? `Stopped after ${requests} requests with ${rows.length} of ${wanted}; more may remain. Continue with --cursor ${next}.`
          : undefined;
      return {
        result,
        envelope: {
          ...merged,
          data: rows,
          meta: { ...merged.meta, limit: wanted, cursor: next ?? null },
        },
        note,
      };
    }
    seen.add(next);
    cursor = next;
  }
}
