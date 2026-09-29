import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  getAgentContactPolicy,
  listDomains,
  PrimitiveApiClient,
  putAgentContactPolicy,
} from "@primitivedotdev/api-core";
import { parseAgentInvitation } from "./agent-connect.js";
import { setupAgent } from "./agent-setup.js";
import { refreshStoredCliCredentials } from "./api-client.js";
import { loadCliCredentials } from "./auth.js";
import {
  AGENT_PROFILE_ENV,
  AgentConnectionSetupError,
  agentProfileDirectory,
  connectedApiBaseUrl,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { parseAgentContactPolicy } from "./contact-policy.js";
import { acquireListenLock } from "./listen-state.js";
import { connectNativeSession, SESSION_UUID } from "./notify-session-native.js";
import {
  mailAddress,
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

const RESPONSE_LIMIT = 32_768;
const refuse = (message: string) => new AgentConnectionSetupError(message);

type Enrollment = {
  version: 1;
  session: string;
  profile: string;
  name: string;
  address: string;
  orgId: string;
  grantId: string;
  apiBaseUrl: string;
  receiverMode: "native" | "external";
  contactRequests: boolean;
  startedAt: string;
  phase: "create_attempted" | "setup_attempted";
  invitationHash: string | null;
  ownerAddress: string | null;
};

type EnrollDependencies = {
  fetch?: typeof fetch;
  now?: () => number;
  preflight?: (
    session: string,
    receiver: "native" | "external",
  ) => Promise<void>;
  setup?: typeof setupAgent;
  env?: NodeJS.ProcessEnv;
};

export type AgentEnrollOptions = {
  configDir: string;
  session: string;
  name?: string;
  receiverMode?: "native" | "external";
  contactRequests?: boolean;
} & EnrollDependencies;

function plainRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function savedEnrollment(value: unknown): Enrollment {
  const row = plainRecord(value);
  const keys = [
    "version",
    "session",
    "profile",
    "name",
    "address",
    "orgId",
    "grantId",
    "apiBaseUrl",
    "receiverMode",
    "contactRequests",
    "startedAt",
    "phase",
    "invitationHash",
    "ownerAddress",
  ];
  if (
    !row ||
    Object.keys(row).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(row, key)) ||
    row.version !== 1 ||
    typeof row.session !== "string" ||
    !SESSION_UUID.test(row.session) ||
    row.profile !== `session-${row.session}` ||
    typeof row.name !== "string" ||
    !validName(row.name) ||
    typeof row.address !== "string" ||
    !validAddress(row.address) ||
    typeof row.orgId !== "string" ||
    !row.orgId ||
    typeof row.grantId !== "string" ||
    !row.grantId ||
    typeof row.apiBaseUrl !== "string" ||
    !["native", "external"].includes(String(row.receiverMode)) ||
    typeof row.contactRequests !== "boolean" ||
    typeof row.startedAt !== "string" ||
    !Number.isFinite(Date.parse(row.startedAt)) ||
    !["create_attempted", "setup_attempted"].includes(String(row.phase)) ||
    (row.phase === "create_attempted" &&
      (row.invitationHash !== null || row.ownerAddress !== null)) ||
    (row.phase === "setup_attempted" &&
      (typeof row.invitationHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(row.invitationHash) ||
        typeof row.ownerAddress !== "string" ||
        !row.ownerAddress.includes("@")))
  )
    throw refuse(
      "Saved enrollment state is invalid. Preserve its private files.",
    );
  connectedApiBaseUrl(row.apiBaseUrl);
  if (row.ownerAddress !== null) {
    try {
      if (mailAddress(row.ownerAddress) !== row.ownerAddress) throw new Error();
    } catch {
      throw refuse(
        "Saved enrollment owner is invalid. Preserve its private files.",
      );
    }
  }
  return row as Enrollment;
}

function validName(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 80 &&
    value.trim() === value &&
    Array.from(value).every((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
  );
}

function validAddress(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[a-z0-9][a-z0-9-]{0,62}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(value)
  );
}

function sessionName(session: string): string {
  return `coding-${session.slice(0, 8)}`;
}

function addressFor(name: string, session: string, domain: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "agent";
  const local = `${slug}-${session.replaceAll("-", "")}`;
  const address = `${local}@${domain.toLowerCase()}`;
  if (!validAddress(address))
    throw refuse("No safe managed address could be selected for this session.");
  return address;
}

async function preflight(
  session: string,
  receiver: "native" | "external",
  env: NodeJS.ProcessEnv,
): Promise<void> {
  if (receiver === "external") {
    if (env.CLAUDE_CODE_SESSION_ID !== session)
      throw refuse(
        "External receiving requires this exact Claude session ID. No address was created.",
      );
    return;
  }
  if (env.CODEX_SESSION_ID && env.CODEX_SESSION_ID !== session)
    throw refuse(
      "The requested session differs from this Codex session. No address was created.",
    );
  if (env.CODEX_THREAD_ID && env.CODEX_THREAD_ID !== session)
    throw refuse(
      "The requested session differs from this Codex thread. No address was created.",
    );
  const connection = await connectNativeSession({
    threadId: session,
    expectedCwd: process.cwd(),
    signal: AbortSignal.timeout(10_000),
  });
  connection.close();
}

async function managedDomain(
  client: PrimitiveApiClient,
  apiBaseUrl: string,
): Promise<string> {
  const response = await listDomains({
    client: client.client,
    responseStyle: "fields",
  });
  const rows = response.data?.data;
  if (response.error || !Array.isArray(rows))
    throw refuse(
      "Could not list the owner's managed domains. No address was created.",
    );
  const suffix =
    apiBaseUrl === "https://api.primitive-staging-1.com/v1"
      ? ".primitive-staging.email"
      : ".primitive.email";
  const domains = rows
    .filter(
      (row) =>
        row.verified === true &&
        "is_active" in row &&
        row.is_active === true &&
        row.domain.toLowerCase().endsWith(suffix),
    )
    .map((row) => row.domain.toLowerCase())
    .filter((domain) => /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(domain))
    .sort();
  if (!domains[0])
    throw refuse(
      "This organization has no verified managed domain for agent enrollment.",
    );
  return domains[0];
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw refuse("The connection creation response is incomplete.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > RESPONSE_LIMIT)
        throw refuse("The connection creation response is too large.");
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw refuse("The connection creation response is incomplete or invalid.");
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function invitationFrom(
  value: unknown,
  expected: Enrollment,
  now: number,
): { url: string; hash: string; ownerAddress: string } {
  const envelope = plainRecord(value);
  const data = plainRecord(envelope?.data);
  const connection = plainRecord(data?.connection);
  const invitation = plainRecord(data?.invitation);
  if (
    envelope?.success !== true ||
    connection?.address !== expected.address ||
    connection?.name !== expected.name ||
    connection?.status !== "pending" ||
    typeof connection.owner_address !== "string" ||
    typeof invitation?.claim_url !== "string" ||
    typeof invitation.expires_at !== "string" ||
    !Number.isFinite(Date.parse(invitation.expires_at)) ||
    Date.parse(invitation.expires_at) <= now + 30_000
  )
    throw refuse(
      "The connection creation result was incomplete or did not match this session. No invitation was claimed.",
    );
  const parsed = parseAgentInvitation(invitation.claim_url);
  if (parsed.apiBaseUrl !== expected.apiBaseUrl)
    throw refuse(
      "The connection invitation origin differs from the owner's login. No invitation was claimed.",
    );
  let ownerAddress: string;
  try {
    ownerAddress = mailAddress(connection.owner_address);
  } catch {
    throw refuse(
      "The connection owner address was invalid. No invitation was claimed.",
    );
  }
  return {
    url: invitation.claim_url,
    hash: createHash("sha256")
      .update(parsed.apiBaseUrl)
      .update("\0")
      .update(parsed.token)
      .digest("hex"),
    ownerAddress,
  };
}

function policyRuleInputs(
  rules: ReadonlyArray<{ pattern: string; effect: "allow" | "silence" }>,
) {
  return rules
    .map(({ pattern, effect }) => ({ pattern, effect }))
    .sort((left, right) => {
      const a = `${left.pattern}:${left.effect}`;
      const b = `${right.pattern}:${right.effect}`;
      return a < b ? -1 : a > b ? 1 : 0;
    });
}

async function enableAgentContactRequests(options: {
  configDir: string;
  address: string;
  orgId: string;
  grantId: string;
  apiBaseUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
}): Promise<void> {
  const saved = loadCliCredentials(options.configDir);
  if (
    !saved ||
    saved.org_id !== options.orgId ||
    saved.oauth_grant_id !== options.grantId ||
    saved.api_base_url !== options.apiBaseUrl
  )
    throw refuse(
      "The saved owner login changed before contact requests were enabled. This agent remains connected; sign in to its organization and resume this exact enrollment.",
    );
  const credentials = await refreshStoredCliCredentials({
    apiBaseUrl: options.apiBaseUrl,
    configDir: options.configDir,
    credentials: saved,
    fetch: options.fetch,
    now: options.now,
  });
  if (
    credentials.org_id !== options.orgId ||
    credentials.oauth_grant_id !== options.grantId ||
    credentials.api_base_url !== options.apiBaseUrl
  )
    throw refuse(
      "The saved owner login changed before contact requests were enabled. This agent remains connected; sign in to its organization and resume this exact enrollment.",
    );
  const client = new PrimitiveApiClient({
    apiKey: credentials.access_token,
    apiBaseUrl: options.apiBaseUrl,
    fetch: options.fetch,
  });
  async function readPolicy() {
    try {
      const response = await getAgentContactPolicy({
        client: client.client,
        path: { agent_address: options.address },
        signal: AbortSignal.timeout(10_000),
        responseStyle: "fields",
      });
      if (
        response.error ||
        response.data?.success !== true ||
        !response.data.data
      )
        throw new Error();
      return parseAgentContactPolicy(response.data.data, options.address);
    } catch {
      throw refuse(
        "The agent contact policy could not be verified. This agent remains connected; resume this exact enrollment after the policy API is available.",
      );
    }
  }
  const before = await readPolicy();
  if (before.agent_policy.allow_contact_requests === false)
    throw refuse(
      "Contact requests were explicitly disabled for this agent. The policy was not changed; review it in the app before resuming enrollment.",
    );
  const rules = policyRuleInputs(before.agent_policy.rules);
  if (before.agent_policy.allow_contact_requests !== true) {
    try {
      const response = await putAgentContactPolicy({
        client: client.client,
        path: { agent_address: options.address },
        body: {
          rules,
          allow_contact_requests: true,
          ...(before.agent_policy.version
            ? { if_version: before.agent_policy.version }
            : { if_absent: true as const }),
        },
        signal: AbortSignal.timeout(10_000),
        responseStyle: "fields",
      });
      if (
        response.error ||
        response.data?.success !== true ||
        !response.data.data
      )
        throw new Error();
      const updated = parseAgentContactPolicy(
        response.data.data,
        options.address,
      );
      if (
        updated.agent_policy.allow_contact_requests !== true ||
        JSON.stringify(policyRuleInputs(updated.agent_policy.rules)) !==
          JSON.stringify(rules)
      )
        throw new Error();
    } catch {
      throw refuse(
        "The contact policy update was not confirmed or conflicted. This agent remains connected; inspect the policy and resume this exact enrollment. No policy write will be guessed.",
      );
    }
  }
  const after = await readPolicy();
  if (
    after.agent_policy.allow_contact_requests !== true ||
    after.allow_contact_requests !== true ||
    !after.contact_request_since ||
    !after.contact_request_generation ||
    JSON.stringify(policyRuleInputs(after.agent_policy.rules)) !==
      JSON.stringify(rules)
  )
    throw refuse(
      "The agent contact policy did not confirm enabled requests with unchanged rules. This agent remains connected; inspect the policy before resuming.",
    );
}

/** Trusted-machine enrollment using only saved owner OAuth and the public API. */
export async function enrollAgent(params: AgentEnrollOptions) {
  if (!SESSION_UUID.test(params.session))
    throw refuse("Enrollment requires the exact current session UUID.");
  const name = params.name ?? sessionName(params.session);
  if (!validName(name))
    throw refuse(
      "Agent name must be 1-80 characters without control characters.",
    );
  const receiverMode = params.receiverMode ?? "native";
  const contactRequests = Boolean(params.contactRequests);
  const env = params.env ?? process.env;
  if (
    env[AGENT_PROFILE_ENV]?.trim() ||
    env.PRIMITIVE_API_KEY?.trim() ||
    env.PRIMITIVE_KEY?.trim()
  )
    throw refuse(
      "Enrollment requires the saved owner OAuth login. Unset agent-profile and API-key environment overrides.",
    );
  const saved = loadCliCredentials(params.configDir);
  if (!saved)
    throw refuse(
      "Sign in with `primitive signin` as this organization's owner or admin first.",
    );
  const apiBaseUrl = connectedApiBaseUrl(saved.api_base_url);
  const profile = `session-${params.session}`;
  const directory = join(
    agentProfileDirectory(params.configDir, profile),
    "enrollment",
  );
  privateMailDirectory(directory, true);
  const release = acquireListenLock(directory, "agent-enrollment");
  try {
    await (
      params.preflight ??
      ((session, receiver) => preflight(session, receiver, env))
    )(params.session, receiverMode);
    const path = join(directory, "state.json");
    const old = readMailJson(path);
    let state = old === null ? null : savedEnrollment(old);
    if (
      state &&
      (state.session !== params.session ||
        state.profile !== profile ||
        state.name !== name ||
        state.orgId !== saved.org_id ||
        state.grantId !== saved.oauth_grant_id ||
        state.apiBaseUrl !== apiBaseUrl ||
        state.receiverMode !== receiverMode ||
        state.contactRequests !== contactRequests)
    )
      throw refuse(
        "This session's enrollment belongs to another owner, address, or setup choice. Nothing was changed.",
      );
    if (
      state &&
      Date.parse(state.startedAt) > (params.now ?? Date.now)() + 60_000
    )
      throw refuse(
        "Saved enrollment time is inconsistent. Preserve its private files.",
      );
    const existing = loadConnectedAgentProfile(params.configDir, profile);
    if (
      existing &&
      (!state ||
        existing.agent_address !== state.address ||
        existing.org_id !== state.orgId ||
        existing.api_base_url !== state.apiBaseUrl ||
        (state.phase === "setup_attempted" &&
          (existing.invitation_hash !== state.invitationHash ||
            existing.owner_address !== state.ownerAddress)))
    )
      throw refuse(
        "This session profile already belongs to another connection. Nothing was changed.",
      );
    const finish = async (
      enrollment: Enrollment,
      resume: boolean,
      invitation?: string,
    ) => {
      const result = await (params.setup ?? setupAgent)({
        configDir: params.configDir,
        profileName: profile,
        session: params.session,
        receiverMode,
        ...(resume ? { resume: true } : { invitation }),
        contactRequests,
        fetch: params.fetch,
      });
      if (!contactRequests)
        return { ...result, contactRequestPolicy: "not_requested" as const };
      if (result.verification.state !== "reply_submitted")
        return {
          ...result,
          contactRequestPolicy: "pending_verification" as const,
        };
      await enableAgentContactRequests({
        configDir: params.configDir,
        address: enrollment.address,
        orgId: enrollment.orgId,
        grantId: enrollment.grantId,
        apiBaseUrl: enrollment.apiBaseUrl,
        fetch: params.fetch,
        now: params.now,
      });
      return { ...result, contactRequestPolicy: "enabled" as const };
    };
    if (state?.phase === "setup_attempted") {
      if (!existing)
        throw refuse(
          "The invitation claim may have been consumed. Keep this pending agent and inspect it in the app; do not create or claim another address.",
        );
      return finish(state, true);
    }
    if (existing)
      throw refuse(
        "This profile is already connected without a matching enrollment. Nothing was changed.",
      );
    if (state)
      throw refuse(
        "Connection creation may already have happened. Inspect this session's pending address in the app and issue a fresh invitation there if needed. Use `primitive agent connect` with that invitation and this session's profile; do not rerun enrollment or create another address.",
      );

    const credentials = await refreshStoredCliCredentials({
      apiBaseUrl,
      configDir: params.configDir,
      credentials: saved,
      fetch: params.fetch,
      now: params.now,
    });
    if (
      credentials.org_id !== saved.org_id ||
      credentials.oauth_grant_id !== saved.oauth_grant_id ||
      credentials.api_base_url !== apiBaseUrl
    )
      throw refuse(
        "The saved owner login changed during enrollment. No address was created. Sign in to the intended organization and retry this exact session.",
      );
    const fetchImpl = params.fetch ?? fetch;
    if (!state) {
      const domain = await managedDomain(
        new PrimitiveApiClient({
          apiKey: credentials.access_token,
          apiBaseUrl,
          fetch: params.fetch,
        }),
        apiBaseUrl,
      );
      const address = addressFor(name, params.session, domain);
      state = {
        version: 1,
        session: params.session,
        profile,
        name,
        address,
        orgId: saved.org_id,
        grantId: saved.oauth_grant_id,
        apiBaseUrl,
        receiverMode,
        contactRequests,
        startedAt: new Date((params.now ?? Date.now)()).toISOString(),
        phase: "create_attempted",
        invitationHash: null,
        ownerAddress: null,
      };
      writeMailJson(path, state);
    }
    let payload: unknown;
    try {
      const response = await fetchImpl(`${apiBaseUrl}/agent-connections`, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        headers: {
          authorization: `Bearer ${credentials.access_token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ name: state.name, address: state.address }),
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error();
      }
      payload = await boundedJson(response);
    } catch {
      throw refuse(
        "Connection creation has an unknown outcome. Inspect this session's pending address in the app and issue a fresh invitation there if needed. Use `primitive agent connect` with that invitation and this session's profile; do not rerun enrollment or create another address.",
      );
    }
    const invitation = invitationFrom(
      payload,
      state,
      (params.now ?? Date.now)(),
    );
    state = {
      ...state,
      phase: "setup_attempted",
      invitationHash: invitation.hash,
      ownerAddress: invitation.ownerAddress,
    };
    writeMailJson(path, state);
    return finish(state, false, invitation.url);
  } finally {
    release();
  }
}
