// `endpoints:test-endpoint` calls POST /endpoints/{id}/test. The server
// implementation only resolves http-kind endpoints by url and returns
// `not_found` for function-kind endpoints (where url is null). The same
// function-endpoint id IS returned by `endpoints:list-endpoints`, so a
// caller naturally tries it against test-endpoint and is greeted with
// "Endpoint not found." Confusing.
//
// This helper closes the loop on the CLI side. After test-endpoint
// returns `not_found`, the dispatcher in `api-command.ts` calls
// `detectFunctionEndpoint` to see whether the id actually belongs to a
// function-kind endpoint owned by the caller. If yes, we replace the
// generic envelope with a redirect to `functions:test-function`,
// surfacing both the endpoint id and the function id so the caller
// does not have to look the function id up themselves.
//
// `kind` and `function_id` are not currently declared on the OpenAPI
// `Endpoint` schema (so they are absent from the generated TS types),
// but they are present in the JSON the server returns. We read them
// off a loose Record<string, unknown> rather than relying on the
// generated type, then sanity-check both fields before treating an
// endpoint as a function endpoint.

// One row of the endpoints list response, loosely typed because the
// generated `Endpoint` type does not include `kind` / `function_id`
// yet. We read those off the raw JSON and validate them here.
type RawEndpointRow = Record<string, unknown>;

// What `detectFunctionEndpoint` resolves to. `kind: 'function'` means
// the caller's id matched a function-kind endpoint we own; both ids
// are returned so the dispatcher can surface them in the redirect
// message. `null` means either no match, the matching endpoint is
// http-kind (so the original `not_found` was a real not_found), or
// the list call itself failed.
export type FunctionEndpointMatch = {
  endpointId: string;
  functionId: string;
};

// The minimal `listEndpoints`-shaped function `detectFunctionEndpoint`
// needs. Both the real generated SDK call and the test fakes implement
// this surface. Modeled on the same `{ data?, error? }` envelope every
// other generated SDK function returns so the dispatcher does not have
// to translate shapes.
export type ListEndpointsFn = () => Promise<{
  data?: { data?: RawEndpointRow[] } | null;
  error?: unknown;
}>;

// Returns a `FunctionEndpointMatch` if and only if `endpointId` matches
// an endpoint in the caller's `listEndpoints` response whose `kind` is
// `function` and whose `function_id` is a non-empty string. Any other
// outcome (no match, http-kind match, list call failure, missing
// fields) returns `null` so the dispatcher falls back to surfacing the
// original error envelope unchanged.
export async function detectFunctionEndpoint(
  endpointId: string,
  listEndpoints: ListEndpointsFn,
): Promise<FunctionEndpointMatch | null> {
  let response: Awaited<ReturnType<ListEndpointsFn>>;
  try {
    response = await listEndpoints();
  } catch {
    return null;
  }

  if (response.error) return null;

  const rows = response.data?.data;
  if (!Array.isArray(rows)) return null;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    if (row.id !== endpointId) continue;
    if (row.kind !== "function") return null;
    const functionId = row.function_id;
    if (typeof functionId !== "string" || functionId.length === 0) return null;
    return { endpointId, functionId };
  }

  return null;
}

// Stderr copy printed when the dispatcher detects the
// `endpoints:test-endpoint` `not_found` was really a function-kind
// endpoint. Surfaces both ids so the caller does not have to run
// `endpoints:list-endpoints` again to find the function_id. Returned
// as a string rather than written here so the call site controls the
// stream (stderr, in practice) and the tests can assert on the value.
export function formatFunctionEndpointRedirect(
  match: FunctionEndpointMatch,
): string {
  return [
    "This is a function endpoint. Function endpoints are tested differently. Run:",
    "",
    `    primitive functions:test-function --id ${match.functionId}`,
    "",
    `(pass the function id, not the endpoint id. endpoint_id=${match.endpointId} function_id=${match.functionId})`,
  ].join("\n");
}

// Inputs the dispatcher passes to `maybeWriteFunctionEndpointRedirect`
// after a generated operation returns an error. Pulled out as a type
// so the unit test can build a minimal call without standing up the
// full oclif command stack.
export interface MaybeRedirectInputs {
  // The manifest entry's sdkName for the operation that just ran.
  // Only `testEndpoint` triggers a redirect attempt; everything else
  // short-circuits.
  sdkName: string;
  // The top-level error code from the operation's response envelope,
  // e.g. `not_found`, `unauthorized`, `validation_error`. Only
  // `not_found` triggers a redirect attempt.
  errorCode: string | undefined;
  // The endpoint id the caller passed (`--id` flag). Absent means the
  // caller never supplied an id, in which case there is nothing to
  // redirect to and we short-circuit.
  endpointId: string | undefined;
  // Constructor for the `listEndpoints` call the dispatcher would run
  // against the resolved API client. Built by the caller so the unit
  // test can pass a static fake without standing up PrimitiveApiClient.
  listEndpoints: ListEndpointsFn;
  // Sink for the redirect copy. Defaults at the call site to
  // `process.stderr.write`; the unit test passes a recording fake.
  writeStderr: (chunk: string) => void;
}

// Post-error hook: if the operation that just failed is
// `endpoints:test-endpoint`, the failure is a `not_found`, and the
// caller's id matches a function-kind endpoint they own, print a
// redirect to `functions:test-function`. Returns the resolved match
// so the caller (and the test) can assert the branch taken without
// scraping stderr.
export async function maybeWriteFunctionEndpointRedirect(
  inputs: MaybeRedirectInputs,
): Promise<FunctionEndpointMatch | null> {
  if (inputs.sdkName !== "testEndpoint") return null;
  if (inputs.errorCode !== "not_found") return null;
  if (!inputs.endpointId) return null;

  const match = await detectFunctionEndpoint(
    inputs.endpointId,
    inputs.listEndpoints,
  );
  if (!match) return null;

  inputs.writeStderr(`${formatFunctionEndpointRedirect(match)}\n`);
  return match;
}
