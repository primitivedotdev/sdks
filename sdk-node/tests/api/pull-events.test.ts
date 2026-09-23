import type {
  CompleteWebhookInput,
  PullWebhookResponse,
} from "@primitivedotdev/api-core";
import { describe, expect, expectTypeOf, it } from "vitest";

function accepted(input: CompleteWebhookInput): boolean {
  switch (input.mode) {
    case "http":
      expectTypeOf(input.status_code).toEqualTypeOf<number | null>();
      return input.status_code === 200;
    case "exec":
      expectTypeOf(input.exit_code).toEqualTypeOf<number | null>();
      return input.exit_code === 0;
    case "sdk":
      expectTypeOf(input.accepted).toEqualTypeOf<boolean>();
      return input.accepted;
    case "stdout":
      expectTypeOf(input.write_succeeded).toEqualTypeOf<boolean>();
      return input.write_succeeded;
    default: {
      const unreachable: never = input;
      return unreachable;
    }
  }
}

describe("generated event receiving types", () => {
  it("narrows completion fields by mode without casts", () => {
    const common = {
      queue_id: "11111111-1111-4111-8111-111111111111",
      delivery_id: "22222222-2222-4222-8222-222222222222",
      lease_token: "33333333-3333-4333-8333-333333333333",
      duration_ms: 10,
    };
    expect(accepted({ ...common, mode: "http", status_code: null })).toBe(
      false,
    );
    expect(accepted({ ...common, mode: "exec", exit_code: 0 })).toBe(true);
    expect(accepted({ ...common, mode: "stdout", write_succeeded: true })).toBe(
      true,
    );
  });

  it("retains string bodies and nullable delivery instead of unknown", () => {
    type Delivery = NonNullable<PullWebhookResponse["data"]["delivery"]>;
    expectTypeOf<Delivery["body"]>().toEqualTypeOf<string>();
    expectTypeOf<Delivery["headers"]>().toEqualTypeOf<Record<string, string>>();
    expectTypeOf<
      PullWebhookResponse["data"]["delivery"]
    >().toEqualTypeOf<Delivery | null>();
  });
});
