import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import {
  type PreparedSignal,
  prepareSignalEmail,
  type SignalInput,
  sendPreparedSignal,
} from "../../src/interactions/index.js";

interface Fixture {
  name: string;
  input: SignalInput;
  now: number;
  uuids: string[];
  status: string;
  prepared?: PreparedSignal;
}
const fixtures: Fixture[] = JSON.parse(
  readFileSync(
    new URL("../../../test-fixtures/signal-emails.json", import.meta.url),
    "utf8",
  ),
);
function fixture(name: string): Fixture {
  const value = fixtures.find((item) => item.name === name);
  if (!value) throw new Error(name);
  return value;
}
function prepare(item: Fixture) {
  let calls = 0;
  const result = prepareSignalEmail(item.input, {
    uuid: () => item.uuids[calls++] ?? "",
    now: () => item.now,
  });
  if (result.status === "waiting_on_parent") expect(calls).toBe(0);
  return result;
}
describe("shared signal email fixtures", () => {
  for (const item of fixtures)
    it(item.name, () => {
      if (item.status === "invalid") {
        expect(() => prepare(item)).toThrow();
        return;
      }
      const result = prepare(item);
      expect(result.status).toBe(item.status);
      if (result.status === "prepared")
        expect(result.prepared).toEqual(item.prepared);
    });
});
it("reuses persisted body and key after uncertain attempts, isolating adapter mutations", async () => {
  const original = prepare(fixture("read"));
  if (original.status !== "prepared") throw new Error("fixture");
  expect(Object.isFrozen(original.prepared)).toBe(true);
  const saved: PreparedSignal = JSON.parse(JSON.stringify(original.prepared));
  const calls: string[] = [];
  const send = async (body: unknown, key: string) => {
    calls.push(JSON.stringify([body, key]));
    if (typeof body === "object" && body !== null)
      Object.assign(body, { to: "changed@example.com" });
    if (calls.length === 1) throw new Error("timeout");
    return { status: "accepted" };
  };
  const opts = {
    accountScope: saved.accountScope,
    now: () => fixture("read").now,
  };
  await expect(sendPreparedSignal(send, saved, opts)).rejects.toThrow(
    "timeout",
  );
  expect(await sendPreparedSignal(send, saved, opts)).toEqual({
    status: "response",
    result: { status: "accepted" },
  });
  expect(calls[0]).toBe(calls[1]);
  await expect(
    sendPreparedSignal(send, saved, { ...opts, accountScope: "another" }),
  ).rejects.toThrow("scope");
  expect(calls).toHaveLength(2);
});
it("refuses expired working at equality without claiming earlier failure", async () => {
  const item = fixture("working"),
    result = prepare(item);
  if (result.status !== "prepared") throw new Error("fixture");
  let calls = 0;
  const send = async () => ++calls;
  expect(
    (
      await sendPreparedSignal(send, result.prepared, {
        accountScope: "account-one",
        now: () => item.now + 59999,
      })
    ).status,
  ).toBe("response");
  expect(
    await sendPreparedSignal(send, result.prepared, {
      accountScope: "account-one",
      now: () => item.now + 60000,
    }),
  ).toEqual({
    status: "expired",
    idempotencyKey: result.prepared.idempotencyKey,
  });
  expect(calls).toBe(1);
});
it("rejects lone surrogates and uses fresh keys for separate preparations", () => {
  const item = fixture("read");
  for (const field of ["subject", "accountScope"] as const)
    expect(() =>
      prepare({
        ...item,
        input: {
          ...item.input,
          parent: { ...item.input.parent, [field]: "\ud800" },
        },
      }),
    ).toThrow();
  const first = prepare(item),
    second = prepare({
      ...item,
      uuids: [
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444",
      ],
    });
  if (first.status !== "prepared" || second.status !== "prepared")
    throw new Error("fixture");
  expect(first.prepared.idempotencyKey).not.toBe(
    second.prepared.idempotencyKey,
  );
});
it("prepares in a browser bundle without Buffer, crypto or a Node runtime", async () => {
  const result = await build({
    entryPoints: [
      new URL("../../src/interactions/index.ts", import.meta.url).pathname,
    ],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    globalName: "interactions",
  });
  const item = fixture("read");
  const context = {
    TextEncoder,
    input: item.input,
    uuids: [...item.uuids],
    now: item.now,
    result: undefined,
  };
  runInNewContext(
    `${result.outputFiles[0]?.text}\nresult=interactions.prepareSignalEmail(input,{uuid:()=>uuids.shift(),now:()=>now})`,
    context,
  );
  expect(context.result).toEqual({
    status: "prepared",
    prepared: item.prepared,
  });
});

it("uses the generated ordinary send operation without dropping body or key", async () => {
  const { createClient, sendEmail } = await import("../../src/api/index.js");
  const result = prepare(fixture("read"));
  if (result.status !== "prepared") throw new Error("fixture");
  const requests: Request[] = [];
  const client = createClient({
    baseUrl: "https://api.example.test/v1",
    fetch: async (request) => {
      requests.push(request as Request);
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "validation_error", message: "fixture" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  const sent = await sendPreparedSignal(
    (body, key) =>
      sendEmail({ client, body, headers: { "Idempotency-Key": key } }),
    result.prepared,
    { accountScope: "account-one", now: () => 1800000000123 },
  );
  expect(sent.status).toBe("response");
  if (sent.status === "response")
    expect(sent.result.response?.status).toBe(400);
  expect(requests[0]?.url).toBe("https://api.example.test/v1/send-mail");
  expect(requests[0]?.headers.get("Idempotency-Key")).toBe(
    result.prepared.idempotencyKey,
  );
  expect(await requests[0]?.json()).toEqual(
    JSON.parse(result.prepared.requestJson),
  );
});
