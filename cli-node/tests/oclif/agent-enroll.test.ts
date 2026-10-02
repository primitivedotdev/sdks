import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, it as test } from "vitest";
import {
  assertNativeSessionIdentity,
  enrollAgent,
} from "../../src/oclif/agent-enroll.js";
import type { setupAgent } from "../../src/oclif/agent-setup.js";
import {
  loadCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const session = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
const stage = "https://api.primitive-staging-1.com/v1";
const clock = Date.parse("2026-09-28T12:00:00.000Z");
const directories: string[] = [];
test("Codex enrollment uses the loaded thread when process and thread IDs differ", () => {
  assert.doesNotThrow(() =>
    assertNativeSessionIdentity(session, {
      CODEX_SESSION_ID: orgId,
      CODEX_THREAD_ID: session,
    }),
  );
  assert.throws(
    () =>
      assertNativeSessionIdentity(orgId, {
        CODEX_SESSION_ID: orgId,
        CODEX_THREAD_ID: session,
      }),
    /differs from this Codex thread/,
  );
  assert.throws(
    () =>
      assertNativeSessionIdentity(orgId, {
        CODEX_SESSION_ID: session,
      }),
    /differs from this Codex session/,
  );
});
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function owner(): string {
  const directory = mkdtempSync(join(tmpdir(), "primitive-enroll-"));
  directories.push(directory);
  saveCliCredentials(directory, {
    auth_method: "oauth",
    access_token: ["prim", "oat", "test"].join("_"),
    refresh_token: ["prim", "ort", "test"].join("_"),
    token_type: "Bearer",
    expires_at: new Date(clock + 60 * 60_000).toISOString(),
    oauth_grant_id: "grant-test",
    oauth_client_id: "client-test",
    org_id: orgId,
    org_name: "Test",
    api_base_url: stage,
    created_at: new Date(clock).toISOString(),
  });
  return directory;
}

function server(
  options: {
    failFirstCreate?: boolean;
    recoveredAfterFailure?: boolean;
    continuationFailure?: boolean;
    claimedRecovery?: boolean;
    expectedName?: string;
    firstCreateStatus?: 400 | 401 | 403 | 409;
    domains?: string[];
    createDenials?: Array<{ status: number; code: string } | null>;
    onCreate?: (address: string, attempt: number) => void;
    wrongOrigin?: boolean;
    policy?: {
      version: string | null;
      allow_contact_requests: boolean | null;
      rules: Array<{
        pattern: string;
        effect: "allow" | "silence";
        notify_since: string | null;
        notification_generation: string | null;
      }>;
    };
    policyConflict?: boolean;
    policyReadbackDisabled?: boolean;
    connectionStatuses?: Array<"pending" | "claimed" | "connected" | "revoked">;
    connectionListUnavailable?: boolean;
    connectionPagesBeforeTarget?: number;
    ownerActive?: boolean;
  } = {},
) {
  const creates: Array<{
    address: string;
    requestId: string;
    auth: string;
    url: string;
  }> = [];
  let first = true;
  let policyReads = 0;
  let connectionListReads = 0;
  let policy = options.policy ?? {
    version: null,
    allow_contact_requests: null,
    rules: [],
  };
  const continuations: string[] = [];
  const policyWrites: Array<Record<string, unknown>> = [];
  const invitation = `${options.wrongOrigin ? "https://api.primitive.dev/v1" : stage}/agent-connections/setup#token=${["invite", "a".repeat(48)].join("_")}`;
  function policyResponse(address: string) {
    const enabled = policy.allow_contact_requests === true;
    const activeAt = new Date(clock).toISOString();
    return {
      success: true,
      data: {
        agent_address: address,
        org_policy: {
          version: null,
          updated_at: null,
          rules: [],
          allow_contact_requests: false,
          contact_request_since: null,
          contact_request_generation: null,
        },
        agent_policy: {
          ...policy,
          updated_at: policy.version === null ? null : activeAt,
          contact_request_since: enabled ? activeAt : null,
          contact_request_generation: enabled
            ? "55555555-5555-4555-8555-555555555555"
            : null,
        },
        effective_version: "a".repeat(64),
        effective_since: activeAt,
        allow_contact_requests: enabled,
        contact_request_since: enabled ? activeAt : null,
        contact_request_generation: enabled ? "b".repeat(64) : null,
      },
    };
  }
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    if (url.startsWith(`${stage}/agent-contact-policy/`)) {
      const address = decodeURIComponent(
        url.slice(`${stage}/agent-contact-policy/`.length),
      );
      if (method === "GET") {
        policyReads++;
        if (options.policyReadbackDisabled && policyWrites.length)
          return Response.json(
            { success: false, error: { code: "service_unavailable" } },
            { status: 503 },
          );
        return Response.json(policyResponse(address));
      }
      if (method === "PUT") {
        const body = JSON.parse(
          String(
            init?.body ?? (input instanceof Request ? await input.text() : ""),
          ),
        ) as Record<string, unknown>;
        policyWrites.push(body);
        if (
          options.policyConflict ||
          (body.if_absent === true && policy.version !== null) ||
          (typeof body.if_version === "string" &&
            body.if_version !== policy.version)
        )
          return Response.json(
            { success: false, error: { code: "contact_conflict" } },
            { status: 409 },
          );
        const rules = body.rules as typeof policy.rules;
        policy = {
          version: "44444444-4444-4444-8444-444444444444",
          allow_contact_requests: body.allow_contact_requests as boolean,
          rules: rules.map(({ pattern, effect }) => ({
            pattern,
            effect,
            notify_since:
              effect === "allow" ? new Date(clock).toISOString() : null,
            notification_generation:
              effect === "allow"
                ? "66666666-6666-4666-8666-666666666666"
                : null,
          })),
        };
        return Response.json(policyResponse(address));
      }
    }
    if (url === `${stage}/domains`) {
      return Response.json({
        success: true,
        data: (
          options.domains ?? [
            "custom.example.test",
            "lucky-eagle.primitive-staging.email",
          ]
        ).map((domain) => ({ domain, verified: true, is_active: true })),
      });
    }
    if (url.endsWith("/invitation") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.deepEqual(body, { pending_only: true });
      continuations.push(url);
      if (options.continuationFailure)
        throw new Error("Uncertain continuation");
      return Response.json({
        success: true,
        data: {
          connection: {
            address: creates.at(-1)?.address,
            name: options.expectedName ?? "Research",
            status: "pending",
            owner_address: "owner@example.test",
          },
          invitation: {
            claim_url: invitation,
            expires_at: new Date(clock + 10 * 60_000).toISOString(),
          },
        },
      });
    }
    if (url === `${stage}/agent-connections` && method === "POST") {
      const body = JSON.parse(
        String(
          init?.body ?? (input instanceof Request ? await input.text() : ""),
        ),
      ) as { name: string; address?: string; create_request_id: string };
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      assert.equal(Object.hasOwn(body, "address"), false);
      assert.match(body.create_request_id, /^[a-f0-9-]{36}$/);
      const address = `${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@lucky-eagle.primitive-staging.email`;
      creates.push({
        address,
        requestId: body.create_request_id,
        auth: headers.get("authorization") ?? "",
        url,
      });
      options.onCreate?.(address, creates.length);
      assert.equal(body.name, options.expectedName ?? "Research");
      if (options.failFirstCreate && first) {
        first = false;
        throw new Error("unavailable");
      }
      if (options.firstCreateStatus && first) {
        first = false;
        return Response.json(
          { success: false, error: { code: "forbidden" } },
          { status: options.firstCreateStatus },
        );
      }
      const denial = options.createDenials?.[creates.length - 1];
      if (denial)
        return Response.json(
          { success: false, error: { code: denial.code } },
          { status: denial.status },
        );
      return Response.json({
        success: true,
        data: {
          connection: {
            address,
            name: body.name,
            owner_address: "owner@example.test",
            status: options.claimedRecovery ? "connected" : "pending",
          },
          ...(options.recoveredAfterFailure && creates.length > 1
            ? { recovered: true }
            : {}),
          invitation:
            options.recoveredAfterFailure && creates.length > 1
              ? null
              : {
                  claim_url: invitation,
                  expires_at: new Date(clock + 10 * 60_000).toISOString(),
                },
        },
      });
    }
    if (url.startsWith(`${stage}/agent-connections?`) && method === "GET") {
      connectionListReads++;
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      assert.equal(
        headers.get("authorization"),
        `Bearer ${["prim", "oat", "test"].join("_")}`,
      );
      if (options.connectionListUnavailable)
        return Response.json({ success: false }, { status: 503 });
      if (connectionListReads <= (options.connectionPagesBeforeTarget ?? 0))
        return Response.json({
          success: true,
          data: [{ address: `other-${connectionListReads}@example.test` }],
          meta: {
            limit: 50,
            cursor: `00000000-0000-4000-8000-${connectionListReads.toString(16).padStart(12, "0")}`,
          },
        });
      const address = creates.at(-1)?.address;
      assert.ok(address);
      const statuses = options.connectionStatuses ?? ["connected"];
      const status =
        statuses[Math.min(connectionListReads - 1, statuses.length - 1)];
      return Response.json({
        success: true,
        data: [
          {
            address,
            name: options.expectedName ?? "Research",
            owner_address: "owner@example.test",
            owner_active: options.ownerActive ?? true,
            status,
            verified_at:
              status === "connected" ? new Date(clock).toISOString() : null,
          },
        ],
        meta: { limit: 50, cursor: null },
      });
    }
    assert.fail(`Unexpected request: ${url}`);
  }) as typeof fetch;
  return {
    fetcher,
    creates,
    continuations,
    invitation,
    policyWrites,
    policyReads: () => policyReads,
    connectionListReads: () => connectionListReads,
  };
}

const result = {
  identity: {
    profileName: `session-${session}`,
    orgId,
    agentAddress: "research@lucky-eagle.primitive-staging.email",
    ownerAddress: "owner@example.test",
    apiBaseUrl: stage,
  },
  verification: { state: "reply_submitted" as const },
  receiving: { state: "external_setup_required" },
  sessionId: session,
  resumeCommand: `primitive agent connect --profile session-${session} --session ${session} --receiver external --resume --json`,
  guidance: "Receiving needs the external hook.",
};

test("owner OAuth creates one readable address and keeps the invitation out of state", async () => {
  const configDir = owner();
  const { fetcher, creates, invitation, policyWrites, connectionListReads } =
    server();
  let setupCalls = 0;
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    contactRequests: true,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async (params) => {
      setupCalls++;
      assert.equal(params.invitation, invitation);
      assert.equal(params.session, session);
      assert.equal(params.profileName, `session-${session}`);
      assert.equal(params.contactRequests, true);
      return result;
    }) as typeof setupAgent,
  });
  assert.deepEqual(value, {
    ...result,
    // The fixture's own-record read does not report the field.
    identity: { ...result.identity, ownerMemberAddress: null },
    guidance: `The owner connection list confirms pairing. Receiving is separate; configure and verify this session's external hook if external mode was selected. No personal owner address is known, so reply to the member who wrote to you; never send reports to ${result.identity.ownerAddress}, the setup and presence control address.`,
    contactRequestPolicy: "enabled",
    connection: { status: "connected" },
  });
  assert.equal(connectionListReads(), 1);
  assert.equal(setupCalls, 1);
  assert.equal(creates.length, 1);
  assert.equal(creates[0]?.address, result.identity.agentAddress);
  assert.equal(creates[0]?.auth, `Bearer ${["prim", "oat", "test"].join("_")}`);
  assert.deepEqual(policyWrites, [
    {
      rules: [],
      allow_contact_requests: true,
      if_absent: true,
    },
  ]);
  const journal = readFileSync(
    join(
      agentProfileDirectory(configDir, `session-${session}`),
      "enrollment",
      "state.json",
    ),
    "utf8",
  );
  assert.equal(journal.includes(invitation), false);
  assert.equal(journal.includes("invite_"), false);
  assert.equal(journal.includes("prim_oat"), false);
  assert.equal(JSON.parse(journal).phase, "setup_attempted");
});

test("one enrollment command confirms pairing through the owner list without an app read", async () => {
  const configDir = owner();
  const { fetcher, creates, connectionListReads } = server({
    connectionStatuses: ["claimed", "connected"],
  });
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    confirmationSleep: async () => undefined,
    setup: (async () => result) as typeof setupAgent,
  });
  assert.equal(value.connection.status, "connected");
  assert.equal(connectionListReads(), 2);
  assert.equal(creates.length, 1);
});

test("one enrollment survives a delayed reconciliation without recreating or reverifying", async () => {
  const configDir = owner();
  const { fetcher, creates, connectionListReads } = server({
    connectionStatuses: [
      ...Array.from({ length: 25 }, () => "claimed" as const),
      "connected",
    ],
  });
  let setupCalls = 0;
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    confirmationSleep: async () => undefined,
    setup: (async () => {
      setupCalls++;
      return result;
    }) as typeof setupAgent,
  });
  assert.equal(value.connection.status, "connected");
  assert.equal(connectionListReads(), 26);
  assert.equal(creates.length, 1);
  assert.equal(setupCalls, 1);
});

test("an inactive human owner is never reported as receiving", async () => {
  const configDir = owner();
  const { fetcher } = server({ ownerActive: false });
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  });
  assert.equal(value.connection.status, "owner_inactive");
  assert.equal(value.receiving.state, "not_ready");
});

test("owner confirmation reaches the target on its final bounded page", async () => {
  const configDir = owner();
  const { fetcher, connectionListReads } = server({
    connectionPagesBeforeTarget: 19,
  });
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    confirmationSleep: async () => undefined,
    setup: (async () => result) as typeof setupAgent,
  });
  assert.equal(value.connection.status, "connected");
  assert.equal(connectionListReads(), 20);
});

test("unconfirmed pairing resumes the same address and never repeats creation or reply", async () => {
  const configDir = owner();
  const {
    fetcher,
    creates,
    connectionListReads,
    invitation: serverInvitation,
  } = server({
    connectionStatuses: [
      ...Array.from({ length: 40 }, () => "claimed" as const),
      "connected",
    ],
  });
  let setupCalls = 0;
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    confirmationSleep: async () => undefined,
    setup: (async (params) => {
      setupCalls++;
      if (setupCalls === 1)
        saveConnectedAgentProfile(configDir, `session-${session}`, {
          version: 1,
          auth_method: "agent_connection",
          api_key: ["pconn", "test"].join("_"),
          api_base_url: stage,
          org_id: orgId,
          agent_address: result.identity.agentAddress,
          owner_address: "owner@example.test",
          invitation_hash: createHash("sha256")
            .update(stage)
            .update("\0")
            .update(
              new URLSearchParams(new URL(serverInvitation).hash.slice(1)).get(
                "token",
              ) ?? "",
            )
            .digest("hex"),
          created_at: new Date(clock).toISOString(),
        });
      else assert.equal(params.resume, true);
      return result;
    }) as typeof setupAgent,
  };
  const first = await enrollAgent(options);
  assert.equal(first.connection.status, "pending");
  const second = await enrollAgent(options);
  assert.equal(second.connection.status, "connected");
  assert.equal(connectionListReads(), 41);
  assert.equal(creates.length, 1);
  assert.equal(setupCalls, 2);
});

test("owner list outage leaves a saved enrollment unconfirmed", async () => {
  const configDir = owner();
  const { fetcher, creates, connectionListReads } = server({
    connectionListUnavailable: true,
  });
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    confirmationSleep: async () => undefined,
    setup: (async () => result) as typeof setupAgent,
  });
  assert.equal(value.connection.status, "unavailable");
  assert.equal(connectionListReads(), 40);
  assert.equal(creates.length, 1);
});

test("enabling contact requests preserves existing agent rules with a version precondition", async () => {
  const configDir = owner();
  const version = "77777777-7777-4777-8777-777777777777";
  const { fetcher, policyWrites } = server({
    policy: {
      version,
      allow_contact_requests: null,
      rules: [
        {
          pattern: "*@trusted.test",
          effect: "allow",
          notify_since: new Date(clock).toISOString(),
          notification_generation: "88888888-8888-4888-8888-888888888888",
        },
      ],
    },
  });
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    contactRequests: true,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  });
  assert.equal(value.contactRequestPolicy, "enabled");
  assert.deepEqual(policyWrites, [
    {
      rules: [{ pattern: "*@trusted.test", effect: "allow" }],
      allow_contact_requests: true,
      if_version: version,
    },
  ]);
});

test("an explicit agent policy disable is never overwritten by enrollment", async () => {
  const configDir = owner();
  const { fetcher, policyWrites } = server({
    policy: {
      version: "77777777-7777-4777-8777-777777777777",
      allow_contact_requests: false,
      rules: [],
    },
  });
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    contactRequests: true,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  });
  assert.equal(value.connection.status, "connected");
  assert.equal(value.contactRequestPolicy, "owner_disabled");
  assert.equal(policyWrites.length, 0);
});

test("an already-enabled exact agent policy needs no write", async () => {
  const configDir = owner();
  const { fetcher, policyWrites, policyReads } = server({
    policy: {
      version: "77777777-7777-4777-8777-777777777777",
      allow_contact_requests: true,
      rules: [],
    },
  });
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    contactRequests: true,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  });
  assert.equal(value.contactRequestPolicy, "enabled");
  assert.equal(policyWrites.length, 0);
  assert.equal(policyReads(), 2);
});

test("contact policy stays pending until verification is submitted", async () => {
  const configDir = owner();
  const { fetcher, policyWrites, policyReads } = server();
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    contactRequests: true,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => ({
      ...result,
      verification: { state: "challenge_pending" },
    })) as typeof setupAgent,
  });
  assert.equal(value.contactRequestPolicy, "pending_verification");
  assert.equal(policyWrites.length, 0);
  assert.equal(policyReads(), 0);
});

test("a changed owner login after claim cannot update another organization's policy", async () => {
  const configDir = owner();
  const { fetcher, policyWrites, policyReads } = server();
  const original = loadCliCredentials(configDir);
  assert.ok(original);
  await assert.rejects(
    enrollAgent({
      configDir,
      session,
      name: "Research",
      receiverMode: "external",
      contactRequests: true,
      env: { CLAUDE_CODE_SESSION_ID: session },
      fetch: fetcher,
      now: () => clock,
      setup: (async () => {
        saveCliCredentials(configDir, {
          ...original,
          org_id: "33333333-3333-4333-8333-333333333333",
          oauth_grant_id: "another-grant",
          access_token: "another-token",
        });
        return result;
      }) as typeof setupAgent,
    }),
    /saved member login changed/,
  );
  assert.equal(policyWrites.length, 0);
  assert.equal(policyReads(), 0);
});

test.each([
  ["conflict", { policyConflict: true }],
  ["readback", { policyReadbackDisabled: true }],
] as const)("does not claim contact intake after a %s", async (_name, policyOptions) => {
  const configDir = owner();
  const { fetcher, policyWrites } = server(policyOptions);
  const value = await enrollAgent({
    configDir,
    session,
    name: "Research",
    receiverMode: "external",
    contactRequests: true,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  });
  assert.equal(value.connection.status, "connected");
  assert.equal(value.contactRequestPolicy, "unavailable");
  assert.equal(policyWrites.length, 1);
});

test("a lost create response recovers the saved request and requires explicit Continue setup", async () => {
  const configDir = owner();
  const { fetcher, creates, continuations } = server({
    failFirstCreate: true,
    recoveredAfterFailure: true,
  });
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  };
  await assert.rejects(enrollAgent(options), /unknown outcome/);
  await assert.rejects(enrollAgent(options), /--continue-setup/);
  assert.equal(creates.length, 2);
  assert.equal(creates[0]?.requestId, creates[1]?.requestId);
  assert.equal(continuations.length, 0);
  const continued = await enrollAgent({ ...options, continueSetup: true });
  assert.equal(continued.connection.status, "connected");
  assert.equal(continuations.length, 1);
  assert.equal(new Set(creates.map((row) => row.requestId)).size, 1);
});

test("a confirmed unavailable domain clears a fresh request without client-side address retries", async () => {
  const configDir = owner();
  const { fetcher, creates } = server({
    domains: ["alpha.primitive-staging.email", "bravo.primitive-staging.email"],
    createDenials: [{ status: 400, code: "connection_domain_unavailable" }],
  });
  await assert.rejects(
    enrollAgent({
      configDir,
      session,
      name: "Research",
      receiverMode: "external",
      env: { CLAUDE_CODE_SESSION_ID: session },
      fetch: fetcher,
      now: () => clock,
    }),
    /No verified managed domain is currently sendable/,
  );
  assert.equal(creates.length, 1);
  assert.equal(
    existsSync(
      join(
        agentProfileDirectory(configDir, `session-${session}`),
        "enrollment",
        "state.json",
      ),
    ),
    false,
  );
});

test.each([
  {
    label: "another 400 code",
    denial: { status: 400, code: "validation_error" },
    held: false,
  },
  {
    label: "a 503 with the domain code",
    denial: { status: 503, code: "connection_domain_unavailable" },
    held: true,
  },
])("does not switch domains after $label", async ({ denial, held }) => {
  const configDir = owner();
  const { fetcher, creates } = server({
    domains: ["alpha.primitive-staging.email", "bravo.primitive-staging.email"],
    createDenials: [denial],
  });
  await assert.rejects(
    enrollAgent({
      configDir,
      session,
      name: "Research",
      receiverMode: "external",
      env: { CLAUDE_CODE_SESSION_ID: session },
      fetch: fetcher,
      now: () => clock,
    }),
    held ? /unknown outcome/ : /rejected before an address was created/,
  );
  assert.equal(creates.length, 1);
  const path = join(
    agentProfileDirectory(configDir, `session-${session}`),
    "enrollment",
    "state.json",
  );
  assert.equal(existsSync(path), held);
  if (held) assert.equal(JSON.parse(readFileSync(path, "utf8")).address, null);
});

test.each([
  400, 401, 403,
] as const)("a proven pre-create %i denial clears the journal for the same-session retry", async (status) => {
  const configDir = owner();
  const { fetcher, creates } = server({ firstCreateStatus: status });
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  };
  await assert.rejects(
    enrollAgent(options),
    /rejected before an address was created/,
  );
  const path = join(
    agentProfileDirectory(configDir, `session-${session}`),
    "enrollment",
    "state.json",
  );
  assert.equal(existsSync(path), false);
  const second = await enrollAgent(options);
  assert.equal(second.connection.status, "connected");
  assert.equal(creates.length, 2);
  assert.equal(creates[0]?.address, creates[1]?.address);
});

test("a 409 create response stays uncertain and is not automatically retried", async () => {
  const configDir = owner();
  const { fetcher, creates } = server({ firstCreateStatus: 409 });
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  };
  await assert.rejects(enrollAgent(options), /unknown outcome/);
  const retried = await enrollAgent(options);
  assert.equal(retried.connection.status, "connected");
  assert.equal(creates.length, 2);
  assert.equal(creates[0]?.requestId, creates[1]?.requestId);
});

test("a saved uncertain create remains held after time passes", async () => {
  const configDir = owner();
  const { fetcher, creates } = server({ failFirstCreate: true });
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  };
  await assert.rejects(enrollAgent(options), /unknown outcome/);
  const path = join(
    agentProfileDirectory(configDir, `session-${session}`),
    "enrollment",
    "state.json",
  );
  const state = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  delete state.createRequestId;
  delete state.continueAttempted;
  writeMailJson(path, {
    ...state,
    version: 1,
    address: result.identity.agentAddress,
    startedAt: new Date(clock - 11 * 60_000).toISOString(),
  });
  await assert.rejects(enrollAgent(options), /may already have happened/);
  assert.equal(creates.length, 1);
});

test("a concurrent owner login change cannot create an agent in another organization", async () => {
  const configDir = owner();
  const original = loadCliCredentials(configDir);
  assert.ok(original);
  saveCliCredentials(configDir, {
    ...original,
    expires_at: new Date(clock + 1_000).toISOString(),
  });
  await assert.rejects(
    enrollAgent({
      configDir,
      session,
      receiverMode: "external",
      env: { CLAUDE_CODE_SESSION_ID: session },
      now: () => clock,
      preflight: async () => {
        saveCliCredentials(configDir, {
          ...original,
          org_id: "33333333-3333-4333-8333-333333333333",
          oauth_grant_id: "another-grant",
          access_token: "another-token",
        });
      },
      fetch: (async () => {
        assert.fail("No organization API call should occur");
      }) as typeof fetch,
    }),
    /saved member login changed/,
  );
});

test("an uncertain claim cannot be replayed without a saved connected profile", async () => {
  const configDir = owner();
  const { fetcher, creates } = server();
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => {
      throw new Error("lost claim response");
    }) as typeof setupAgent,
  };
  await assert.rejects(enrollAgent(options), /lost claim response/);
  await assert.rejects(enrollAgent(options), /claim may have been consumed/);
  assert.equal(creates.length, 1);
});

test("a saved claim resumes setup without creating another connection", async () => {
  const configDir = owner();
  const { fetcher, creates, invitation } = server();
  let calls = 0;
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async (params) => {
      calls++;
      if (calls === 1) {
        saveConnectedAgentProfile(configDir, `session-${session}`, {
          version: 1,
          auth_method: "agent_connection",
          api_key: ["pconn", "test"].join("_"),
          api_base_url: stage,
          org_id: orgId,
          agent_address: result.identity.agentAddress,
          owner_address: "owner@example.test",
          invitation_hash: createHash("sha256")
            .update(stage)
            .update("\0")
            .update(
              new URLSearchParams(new URL(invitation).hash.slice(1)).get(
                "token",
              ) ?? "",
            )
            .digest("hex"),
          created_at: new Date(clock).toISOString(),
        });
        throw new Error("interrupted after durable claim");
      }
      assert.equal(params.resume, true);
      assert.equal(params.invitation, undefined);
      return result;
    }) as typeof setupAgent,
  };
  await assert.rejects(enrollAgent(options), /interrupted after durable claim/);
  await enrollAgent(options);
  assert.equal(calls, 2);
  assert.equal(creates.length, 1);
});

test("a different invitation cannot be adopted even at the same address", async () => {
  const configDir = owner();
  const { fetcher, creates } = server();
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => {
      saveConnectedAgentProfile(configDir, `session-${session}`, {
        version: 1,
        auth_method: "agent_connection",
        api_key: ["pconn", "test"].join("_"),
        api_base_url: stage,
        org_id: orgId,
        agent_address: result.identity.agentAddress,
        owner_address: "owner@example.test",
        invitation_hash: "b".repeat(64),
        created_at: new Date(clock).toISOString(),
      });
      throw new Error("interrupted");
    }) as typeof setupAgent,
  };
  await assert.rejects(enrollAgent(options), /interrupted/);
  await assert.rejects(enrollAgent(options), /another connection/);
  assert.equal(creates.length, 1);
});

test("wrong session, ambient API key, and invitation origin fail before claim", async () => {
  const configDir = owner();
  const { fetcher, creates } = server({ wrongOrigin: true });
  const base = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    fetch: fetcher,
    now: () => clock,
    setup: (async () => assert.fail("No claim expected")) as typeof setupAgent,
  };
  await assert.rejects(
    enrollAgent({
      ...base,
      env: { CLAUDE_CODE_SESSION_ID: "22222222-2222-4222-8222-222222222222" },
    }),
    /exact Claude session/,
  );
  await assert.rejects(
    enrollAgent({
      ...base,
      env: { CLAUDE_CODE_SESSION_ID: session, PRIMITIVE_API_KEY: "ambient" },
    }),
    /saved member OAuth/,
  );
  assert.equal(creates.length, 0);
  await assert.rejects(
    enrollAgent({ ...base, env: { CLAUDE_CODE_SESSION_ID: session } }),
    /invitation origin differs/,
  );
  assert.equal(creates.length, 1);
});

test("saves the new creation request before dispatch and gives new sessions a friendly default", async () => {
  const configDir = owner();
  const path = join(
    agentProfileDirectory(configDir, `session-${session}`),
    "enrollment",
    "state.json",
  );
  const { fetcher, creates } = server({
    expectedName: "Coding agent",
    onCreate: () => {
      const state = JSON.parse(readFileSync(path, "utf8")) as Record<
        string,
        unknown
      >;
      assert.equal(state.version, 2);
      assert.equal(state.address, null);
      assert.match(String(state.createRequestId), /^[a-f0-9-]{36}$/);
      assert.equal(state.continueAttempted, false);
    },
  });
  const value = await enrollAgent({
    configDir,
    session,
    receiverMode: "external",
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => ({
      ...result,
      identity: {
        ...result.identity,
        agentAddress: "coding-agent@lucky-eagle.primitive-staging.email",
      },
    })) as typeof setupAgent,
  });
  assert.equal(
    value.identity.agentAddress,
    "coding-agent@lucky-eagle.primitive-staging.email",
  );
  assert.equal(creates.length, 1);
  assert.equal(creates[0]?.address.includes(session), false);
  assert.equal(
    JSON.parse(readFileSync(path, "utf8")).createRequestId,
    creates[0]?.requestId,
  );
});

test("an uncertain Continue setup is durably held and cannot invalidate another invitation on rerun", async () => {
  const configDir = owner();
  const { fetcher, creates, continuations } = server({
    failFirstCreate: true,
    recoveredAfterFailure: true,
    continuationFailure: true,
  });
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => result) as typeof setupAgent,
  };
  await assert.rejects(enrollAgent(options), /unknown outcome/);
  await assert.rejects(
    enrollAgent({ ...options, continueSetup: true }),
    /Continue setup has an uncertain outcome/,
  );
  const count = creates.length;
  await assert.rejects(
    enrollAgent({ ...options, continueSetup: true }),
    /Continue setup already ran/,
  );
  assert.equal(creates.length, count);
  assert.equal(continuations.length, 1);
});

test("a recovered claimed identity never gets an automatic invitation or reconnect", async () => {
  const configDir = owner();
  const { fetcher, continuations } = server({
    failFirstCreate: true,
    recoveredAfterFailure: true,
    claimedRecovery: true,
  });
  let setups = 0;
  const options = {
    configDir,
    session,
    name: "Research",
    receiverMode: "external" as const,
    env: { CLAUDE_CODE_SESSION_ID: session },
    fetch: fetcher,
    now: () => clock,
    setup: (async () => {
      setups++;
      return result;
    }) as typeof setupAgent,
  };
  await assert.rejects(enrollAgent(options), /unknown outcome/);
  await assert.rejects(
    enrollAgent({ ...options, continueSetup: true }),
    /credential was not changed/,
  );
  assert.equal(continuations.length, 0);
  assert.equal(setups, 0);
});
