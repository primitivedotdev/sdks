import { randomUUID } from "node:crypto";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ConnectedAgentIdentity } from "../../src/oclif/connected-agent-profile.js";
import {
  MAX_PENDING_CONTACT_REQUESTS,
  openContactRequestNotices,
} from "../../src/oclif/contact-request-state.js";
import type { NotificationReceipt } from "../../src/oclif/notify-session-state.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function setup() {
  const root = mkdtempSync(join(tmpdir(), "contact-request-proof-"));
  roots.push(root);
  const identity: ConnectedAgentIdentity = {
    profileName: "session-one",
    orgId: randomUUID(),
    agentAddress: "agent@example.test",
    ownerAddress: "owner@example.test",
    apiBaseUrl: "https://api.example.test/v1",
  };
  return { root, identity, ledger: openContactRequestNotices(root, identity) };
}
const receipt = (): NotificationReceipt => ({
  emailId: randomUUID(),
  eventId: randomUUID(),
  clientId: randomUUID(),
  state: "submitting",
});
function stateFile(root: string) {
  const parent = join(root, "contact-request-notices"),
    children = readdirSync(parent);
  expect(children).toHaveLength(1);
  return join(parent, children[0], "notices.json");
}

describe("durable first-contact notices", () => {
  it("retains the initial activation boundary across a new profile and receiver restart", () => {
    const { root, identity, ledger } = setup();
    const first = Date.parse("2026-09-28T12:00:00Z");
    expect(ledger.activate(first)).toBe(new Date(first).toISOString());
    const restarted = openContactRequestNotices(root, {
      ...identity,
      profileName: "rotated-profile",
    });
    expect(restarted.activate(first + 60000)).toBe(
      new Date(first).toISOString(),
    );
    expect(restarted.activate(first - 60000)).toBe(
      new Date(first).toISOString(),
    );
  });

  it("holds uncertain submission across changed session, event and credential profile", () => {
    const { root, identity, ledger } = setup();
    ledger.activate();
    expect(
      ledger.reserve("peer@example.test", randomUUID(), receipt(), []),
    ).toBe("reserved");
    const restarted = openContactRequestNotices(root, {
      ...identity,
      profileName: "new-profile",
    });
    expect(
      restarted.reserve("peer@example.test", randomUUID(), receipt(), []),
    ).toBe("duplicate");
    expect(
      restarted.reserve("other@example.test", randomUUID(), receipt(), []),
    ).toBe("reserved");
  });

  it("isolates origin, organization and receiving address", () => {
    const { root, identity, ledger } = setup();
    ledger.activate();
    expect(
      ledger.reserve("peer@example.test", randomUUID(), receipt(), []),
    ).toBe("reserved");
    for (const changed of [
      { orgId: randomUUID() },
      { agentAddress: "another@example.test" },
      { apiBaseUrl: "https://staging.example.test/v1" },
    ]) {
      const separate = openContactRequestNotices(root, {
        ...identity,
        ...changed,
      });
      separate.activate();
      expect(
        separate.reserve("peer@example.test", randomUUID(), receipt(), []),
      ).toBe("reserved");
    }
  });

  it("bounds pending unknown senders, frees decided capacity, and preserves their duplicate tombstone", () => {
    const { ledger } = setup();
    ledger.activate();
    for (let i = 0; i < MAX_PENDING_CONTACT_REQUESTS; i++)
      expect(
        ledger.reserve(`peer-${i}@example.test`, randomUUID(), receipt(), []),
      ).toBe("reserved");
    expect(
      ledger.reserve("overflow@example.test", randomUUID(), receipt(), []),
    ).toBe("full");
    expect(
      ledger.reserve("overflow@example.test", randomUUID(), receipt(), [
        "peer-0@example.test",
      ]),
    ).toBe("reserved");
    expect(
      ledger.reserve("peer-0@example.test", randomUUID(), receipt(), []),
    ).toBe("duplicate");
    expect(
      ledger.reserve("next@example.test", randomUUID(), receipt(), []),
    ).toBe("full");
  });

  it("stores only hashed sender identity with private permissions and refuses corrupt durable state", () => {
    const { root, identity, ledger } = setup();
    ledger.activate();
    ledger.reserve("private-peer@example.test", randomUUID(), receipt(), []);
    const file = stateFile(root),
      original = readFileSync(file, "utf8");
    expect(original).not.toContain("private-peer@example.test");
    if (process.platform !== "win32")
      expect(statSync(file).mode & 0o777).toBe(0o600);
    writeFileSync(file, "{interrupted", { mode: 0o600 });
    const reopened = openContactRequestNotices(root, identity);
    expect(() => reopened.activate()).toThrow();
    expect(() =>
      reopened.reserve("peer@example.test", randomUUID(), receipt(), []),
    ).toThrow();
    expect(readFileSync(file, "utf8")).toBe("{interrupted");
  });
});
