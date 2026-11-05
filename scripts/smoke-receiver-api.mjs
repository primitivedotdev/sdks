// Consume the installed package the way a harness receiver does: import
// `primitive/receiver` by name, run admission with fake readers, typecheck a
// receiver against the published declarations, and confirm the unsupported
// `primitive/bin/*` and `primitive/dist/*` paths still resolve.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = realpathSync(process.argv[2]);
const packageDir = dirname(dirname(cli));
const installRoot = dirname(dirname(packageDir));
const consumer = mkdtempSync(join(installRoot, "receiver-consumer-"));
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const tsc = createRequire(join(repoRoot, "cli-node", "package.json")).resolve(
  "typescript/bin/tsc",
);

function node(file) {
  const result = spawnSync(process.execPath, [file], {
    cwd: consumer,
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(result.status, 0, `${file}\n${result.stdout}${result.stderr}`);
  return result.stdout;
}

const chunk = readdirSync(join(packageDir, "dist")).find((name) =>
  /^machine-session-.+\.js$/.test(name),
);
assert.ok(chunk, "a hashed CLI chunk exists for the deep-import check");

writeFileSync(
  join(consumer, "runtime.mjs"),
  `
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createWakePolicy, WakePolicyError } from "primitive/receiver";

const recipient = "agent@example.com";
const contact = "owner@example.com";
const stranger = "stranger@example.com";
const activation = "2026-09-01T10:00:00.000Z";
const receivedAt = "2026-09-01T10:01:00.000Z";
const signal = new AbortController().signal;
const empty = {
  rules: [],
  contact_request_since: null,
  contact_request_generation: null,
  version: null,
  updated_at: null,
};
function document(requests) {
  return {
    agent_address: recipient,
    org_policy: { ...empty, allow_contact_requests: false },
    agent_policy: requests
      ? {
          rules: [],
          allow_contact_requests: true,
          contact_request_since: activation,
          contact_request_generation: randomUUID(),
          version: randomUUID(),
          updated_at: activation,
        }
      : { ...empty, allow_contact_requests: null },
    effective_version: "a".repeat(64),
    effective_since: "2026-01-01T00:00:00.000Z",
    allow_contact_requests: requests,
    contact_request_since: requests ? activation : null,
    contact_request_generation: requests ? "b".repeat(64) : null,
  };
}
const row = {
  agent_address: recipient,
  contact_address: contact,
  notify: true,
  notify_since: activation,
  notification_generation: randomUUID(),
  version: randomUUID(),
};
function policy(requests, network = {}) {
  return createWakePolicy({
    recipient,
    contactRequests: requests,
    readContactPolicy: async () => document(requests),
    readContactPage: async () => ({ data: [row], cursor: null }),
    readNetworkAdmission: async () => ({
      allowed: false,
      allowed_since: null,
      pending: false,
      member_policy_required: false,
      ...network,
    }),
  });
}
const email = (sender) => ({ emailId: randomUUID(), sender, receivedAt });

const allowed = policy(false);
const admitted = await allowed.admit(email(contact), signal);
assert.equal(admitted.kind, "allowed");
(await allowed.recheck(admitted, signal))();
assert.equal((await policy(true).admit(email(stranger), signal)).kind, "request");
assert.equal((await policy(false).admit(email(stranger), signal)).kind, "denied");
await assert.rejects(
  policy(false, { pending: true }).admit(email(stranger), signal),
  (error) =>
    error instanceof WakePolicyError &&
    error.code === "network_admission_pending" &&
    error.retryable,
);

const require = createRequire(import.meta.url);
assert.match(require.resolve("primitive/bin/run.js"), /bin[\\\\/]run\\.js$/);
assert.equal(require("primitive/package.json").name, "primitive");
await import("primitive/dist/oclif/proxy-auto-detect.js");
await import("primitive/dist/${chunk}");
console.log("receiver runtime ok");
`,
);
assert.match(node("runtime.mjs"), /receiver runtime ok/);

writeFileSync(
  join(consumer, "receiver.ts"),
  `
import {
  createWakePolicy,
  type NetworkAdmission,
  WakePolicyError,
} from "primitive/receiver";

declare const binding: { address: string; contactRequests: boolean };
declare function cli(args: readonly string[], signal: AbortSignal): Promise<unknown>;
declare function parsePage(value: unknown): {
  data: unknown[];
  meta: { cursor: string | null };
};
declare function parseDecision(value: unknown): {
  allowed: boolean;
  pending: boolean;
  allowed_since: string | null;
  member_policy_required: boolean;
  sender_relation?: "owner" | "member" | undefined;
};

const policy = createWakePolicy({
  recipient: binding.address,
  contactRequests: binding.contactRequests,
  readContactPolicy: (signal) =>
    cli(["contacts", "get-agent-contact-policy", "--agent-address", binding.address], signal),
  async readContactPage(cursor, signal) {
    const page = parsePage(
      await cli(
        ["agent", "contacts", "list", "--limit", "100",
          ...(cursor === undefined ? [] : ["--cursor", cursor])],
        signal,
      ),
    );
    return { data: page.data, cursor: page.meta.cursor };
  },
  async readNetworkAdmission(emailId, sender, signal): Promise<NetworkAdmission> {
    return parseDecision(
      await cli(
        ["agent-networks", "check-default-network-contact-admission",
          "--email-id", emailId, "--sender-address", sender],
        signal,
      ),
    );
  },
});

export async function admit(
  mail: { id: string; from_email: string; received_at: string },
  signal: AbortSignal,
): Promise<{ request: boolean; current: () => void } | null> {
  try {
    const admission = await policy.admit(
      { emailId: mail.id, sender: mail.from_email, receivedAt: mail.received_at },
      signal,
    );
    if (admission.kind === "denied") return null;
    const request = admission.kind === "request";
    const current = await policy.recheck(admission, signal);
    return { request, current };
  } catch (error) {
    if (error instanceof WakePolicyError && error.retryable) return null;
    throw error;
  }
}
`,
);

for (const resolution of [
  { module: "ESNext", moduleResolution: "bundler" },
  { module: "NodeNext", moduleResolution: "NodeNext" },
]) {
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        ...resolution,
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        types: [],
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        noPropertyAccessFromIndexSignature: true,
        verbatimModuleSyntax: true,
        isolatedModules: true,
        noEmit: true,
        skipLibCheck: false,
      },
      files: ["receiver.ts"],
    }),
  );
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "receiver-consumer", private: true, type: "module" }),
  );
  const result = spawnSync(process.execPath, [tsc, "-p", "tsconfig.json"], {
    cwd: consumer,
    encoding: "utf8",
    timeout: 120_000,
  });
  assert.equal(
    result.status,
    0,
    `${resolution.moduleResolution}: ${result.stdout}${result.stderr}`,
  );
}
console.log("receiver API smoke passed");
