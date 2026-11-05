import { describe, expect, it } from "vitest";
import {
  type OrgLeaveInput,
  organizationLeaveUrl,
  orgLeaveRequestTarget,
  runOrgLeave,
  STEP_UP_HEADER,
} from "../../src/oclif/commands/org-leave.js";
import { COMMANDS } from "../../src/oclif/index.js";

const BASE = "https://api.example.test/v1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const LEFT = { success: true, data: { left: true, id: "user-1" } };

const STEP_UP_REQUIRED = {
  success: false,
  error: {
    code: "step_up_required",
    message:
      "Leave the organization needs the person to confirm in the dashboard.",
    details: {
      purpose: "members.remove",
      target_user_id: "user-1",
      step_up_url:
        "https://app.example.test/app/settings/step-up?purpose=members.remove",
    },
  },
};

type Call = { url: string; init: RequestInit | undefined };

function harness(
  responses: Response[],
  overrides: Partial<OrgLeaveInput> = {},
  answers: string[] = [],
) {
  const calls: Call[] = [];
  const prompts: string[] = [];
  const written: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return next;
  }) as unknown as typeof fetch;
  const input: OrgLeaveInput = {
    fetchImpl,
    baseUrl: BASE,
    headers: { authorization: "Bearer t" },
    orgLabel: "organization Acme (org-1)",
    yes: false,
    interactive: true,
    prompt: async (question) => {
      prompts.push(question);
      return answers.shift() ?? "";
    },
    write: (text) => {
      written.push(text);
    },
    ...overrides,
  };
  return { calls, prompts, written, input };
}

function headerOf(call: Call | undefined, name: string): string | undefined {
  return (call?.init?.headers as Record<string, string> | undefined)?.[name];
}

describe("organizationLeaveUrl", () => {
  it("builds the leave URL and trims a trailing slash", () => {
    expect(organizationLeaveUrl(BASE)).toBe(
      "https://api.example.test/v1/organization/leave",
    );
    expect(organizationLeaveUrl(`${BASE}/`)).toBe(
      "https://api.example.test/v1/organization/leave",
    );
  });
});

describe("runOrgLeave", () => {
  it("asks for confirmation, then POSTs the leave route", async () => {
    const h = harness([jsonResponse(LEFT)], {}, ["y"]);
    const out = await runOrgLeave(h.input);
    expect(out).toEqual({ kind: "left", data: { left: true, id: "user-1" } });
    expect(h.prompts).toHaveLength(1);
    expect(h.prompts[0]).toContain("Leave organization Acme (org-1)?");
    expect(h.prompts[0]).toContain("Leaving is final");
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]?.url).toBe(
      "https://api.example.test/v1/organization/leave",
    );
    expect(h.calls[0]?.init?.method).toBe("POST");
    expect(headerOf(h.calls[0], "authorization")).toBe("Bearer t");
    expect(headerOf(h.calls[0], STEP_UP_HEADER)).toBeUndefined();
  });

  it("sends nothing when the prompt is not answered yes", async () => {
    for (const answer of ["", "n", "no", "leave"]) {
      const h = harness([], {}, [answer]);
      expect(await runOrgLeave(h.input)).toEqual({ kind: "cancelled" });
      expect(h.calls).toHaveLength(0);
    }
  });

  it("refuses without a terminal unless --yes is passed", async () => {
    const h = harness([], { interactive: false });
    expect(await runOrgLeave(h.input)).toEqual({ kind: "needs_confirmation" });
    expect(h.prompts).toHaveLength(0);
    expect(h.calls).toHaveLength(0);
  });

  it("--yes skips the prompt", async () => {
    const h = harness([jsonResponse(LEFT)], { yes: true, interactive: false });
    const out = await runOrgLeave(h.input);
    expect(out.kind).toBe("left");
    expect(h.prompts).toHaveLength(0);
    expect(h.calls).toHaveLength(1);
  });

  it("returns the server's refusal unchanged", async () => {
    const refusal = {
      code: "last_owner",
      message:
        "You are the only owner of this organization. Make someone else an owner before you leave.",
    };
    const h = harness([jsonResponse({ success: false, error: refusal }, 409)], {
      yes: true,
    });
    expect(await runOrgLeave(h.input)).toEqual({
      kind: "error",
      payload: refusal,
      stepUpUrl: undefined,
    });
    expect(h.calls).toHaveLength(1);
  });

  it("returns a non-JSON error body as an http_error", async () => {
    const h = harness(
      [new Response("bad gateway", { status: 502, statusText: "Bad Gateway" })],
      { yes: true },
    );
    expect(await runOrgLeave(h.input)).toEqual({
      kind: "error",
      payload: { code: "http_error", message: "bad gateway" },
      stepUpUrl: undefined,
    });
  });

  it("sends --step-up-token in the Primitive-Step-Up header", async () => {
    const h = harness([jsonResponse(LEFT)], {
      yes: true,
      stepUpToken: "pstep_abc",
    });
    expect((await runOrgLeave(h.input)).kind).toBe("left");
    expect(headerOf(h.calls[0], STEP_UP_HEADER)).toBe("pstep_abc");
  });

  it("asks for the dashboard token and retries once when the server asks for confirmation", async () => {
    const h = harness(
      [jsonResponse(STEP_UP_REQUIRED, 403), jsonResponse(LEFT)],
      { yes: true },
      [" pstep_xyz "],
    );
    expect((await runOrgLeave(h.input)).kind).toBe("left");
    expect(h.written.join("")).toContain(
      STEP_UP_REQUIRED.error.details.step_up_url,
    );
    expect(h.prompts).toEqual(["Token: "]);
    expect(h.calls).toHaveLength(2);
    expect(headerOf(h.calls[0], STEP_UP_HEADER)).toBeUndefined();
    expect(headerOf(h.calls[1], STEP_UP_HEADER)).toBe("pstep_xyz");
  });

  it("returns the retry's refusal unchanged", async () => {
    const refusal = { code: "forbidden", message: "Step-up token expired." };
    const h = harness(
      [
        jsonResponse(STEP_UP_REQUIRED, 403),
        jsonResponse({ success: false, error: refusal }, 403),
      ],
      { yes: true },
      ["pstep_old"],
    );
    expect(await runOrgLeave(h.input)).toEqual({
      kind: "error",
      payload: refusal,
    });
    expect(h.calls).toHaveLength(2);
  });

  it("does not retry when no token is pasted", async () => {
    const h = harness([jsonResponse(STEP_UP_REQUIRED, 403)], { yes: true }, [
      "",
    ]);
    expect(await runOrgLeave(h.input)).toEqual({
      kind: "error",
      payload: STEP_UP_REQUIRED.error,
      stepUpUrl: STEP_UP_REQUIRED.error.details.step_up_url,
    });
    expect(h.calls).toHaveLength(1);
  });

  it("returns the confirmation page without prompting in a script", async () => {
    const h = harness([jsonResponse(STEP_UP_REQUIRED, 403)], {
      yes: true,
      interactive: false,
    });
    expect(await runOrgLeave(h.input)).toEqual({
      kind: "error",
      payload: STEP_UP_REQUIRED.error,
      stepUpUrl: STEP_UP_REQUIRED.error.details.step_up_url,
    });
    expect(h.prompts).toHaveLength(0);
    expect(h.calls).toHaveLength(1);
  });

  it("does not prompt again when a passed token is refused", async () => {
    const h = harness([jsonResponse(STEP_UP_REQUIRED, 403)], {
      yes: true,
      stepUpToken: "pstep_bad",
    });
    const out = await runOrgLeave(h.input);
    expect(out.kind).toBe("error");
    expect(h.prompts).toHaveLength(0);
    expect(h.calls).toHaveLength(1);
  });
});

describe("org leave command", () => {
  it("is registered with --yes and --step-up-token", () => {
    const command = COMMANDS["org:leave"];
    expect(command).toBeDefined();
    const flags = (command as unknown as { flags: Record<string, unknown> })
      .flags;
    expect(flags).toHaveProperty("yes");
    expect(flags).toHaveProperty("step-up-token");
  });
});

describe("orgLeaveRequestTarget", () => {
  it("sends the token to the origin it was issued for, not the overridden base URL", () => {
    const target = orgLeaveRequestTarget(
      { apiKey: "oauth_tok", apiBaseUrl: "https://api.primitive.dev/v1" },
      { "x-extra": "1" },
    );
    expect(target.baseUrl).toBe("https://api.primitive.dev/v1");
    expect(target.headers).toEqual({
      "x-extra": "1",
      authorization: "Bearer oauth_tok",
    });
  });

  it("omits configured headers for a connected agent profile", () => {
    const target = orgLeaveRequestTarget(
      {
        apiKey: "pconn_x",
        apiBaseUrl: "https://api.primitive.dev/v1",
        connectedAgent: {} as never,
      },
      { "x-extra": "1" },
    );
    expect(target.headers).toEqual({ authorization: "Bearer pconn_x" });
  });

  it("sends no authorization header without a credential", () => {
    expect(
      orgLeaveRequestTarget(
        { apiKey: undefined, apiBaseUrl: "https://api.primitive.dev/v1" },
        undefined,
      ).headers,
    ).toEqual({});
  });
});
