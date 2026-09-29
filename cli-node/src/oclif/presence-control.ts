import {
  type PresenceDisposition,
  presenceDisposition,
  readPresenceProjection as projection,
} from "./presence-provenance.js";

export { presenceDisposition } from "./presence-provenance.js";

import { createHash, randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  type EmailDetail,
  getEmail,
  type PrimitiveApiClient,
  sendEmail,
} from "@primitivedotdev/api-core";
import {
  MAX_PRESENCE_ENVELOPE_BYTES,
  PRESENCE_PROBE_TEXT,
  parsePresenceEnvelope,
  preparePresenceAliveEmail,
} from "@primitivedotdev/sdk/interactions";
import {
  agentProfileDirectory,
  type ConnectedAgentIdentity,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import { notificationPartReader } from "./notify-session-content.js";
import { reconcileChatSend } from "./reconcile-chat-send.js";
import { successfulSendOutcome } from "./send-outcome.js";
import {
  mailId,
  mailLockBusy,
  mailObject,
  privateMailDirectory,
  readMailJson,
  removeMailFile,
  writeMailJson,
} from "./shared-mail-files.js";
import { sharedMailScope } from "./shared-mail-receiver.js";

type Prepared = Extract<
  ReturnType<typeof preparePresenceAliveEmail>,
  { status: "prepared" }
>["prepared"];
type Intent = {
  version: 1;
  prepared: Prepared;
  phase: "prepared" | "submitting" | "uncertain" | "sent" | "declined";
};
type Pending = {
  version: 1;
  emailId: string;
  eventId: string;
  attempts: number;
};

/** Runs within an existing receiver. Pending IDs reconcile independently of task mail. */
export function openPresenceControls(options: {
  configDir: string;
  apiClient: PrimitiveApiClient;
  apiKey: string | undefined;
  baseUrl: string;
  identity?: ConnectedAgentIdentity;
  sessionKey?: string | null;
  signal: AbortSignal;
  eligible?: () => Promise<boolean>;
  onOrdinary?: (detail: EmailDetail, eventId: string) => Promise<boolean>;
  monotonic?: () => number;
  retryMs?: number;
}) {
  const clock = options.monotonic ?? (() => performance.now());
  const stopping = new AbortController();
  const signal = AbortSignal.any([options.signal, stopping.signal]);
  const scope = options.apiKey?.startsWith("pconn_")
    ? sharedMailScope(options.apiKey, options.baseUrl)
    : null;
  const directory = scope ? join(options.configDir, "presence", scope) : null;
  const pendingDirectory = directory ? join(directory, "pending") : null;
  const originDirectory = directory ? join(directory, "controls") : null;
  const pending = new Map<string, { row: Pending; due: number }>();
  let background: Promise<void> | undefined;
  let closed = false;
  if (originDirectory) privateMailDirectory(originDirectory, true);
  function knownControl(id: string) {
    if (!originDirectory) return false;
    const raw = readMailJson(join(originDirectory, `${mailId(id)}.json`));
    if (raw === null) return false;
    const row = mailObject(raw, ["version", "emailId"]);
    if (row.version !== 1 || row.emailId !== id)
      throw new Error("Saved presence control origin is invalid.");
    return true;
  }
  function rememberControl(id: string) {
    if (originDirectory)
      writeMailJson(join(originDirectory, `${mailId(id)}.json`), {
        version: 1,
        emailId: id,
      });
  }
  if (pendingDirectory) {
    privateMailDirectory(pendingDirectory, true);
    for (const name of readdirSync(pendingDirectory)) {
      if (!/^[a-f0-9-]{36}\.json$/i.test(name)) continue;
      const saved = readMailJson(join(pendingDirectory, name));
      const raw = mailObject(saved, [
        "version",
        "emailId",
        "eventId",
        ...(saved &&
        typeof saved === "object" &&
        Object.hasOwn(saved, "attempts")
          ? ["attempts"]
          : []),
      ]);
      const attempts = raw.attempts ?? 0;
      if (
        raw.version !== 1 ||
        !Number.isSafeInteger(attempts) ||
        Number(attempts) < 0 ||
        Number(attempts) > 6
      )
        throw new Error("Saved presence reconciliation is invalid.");
      const row: Pending = {
        version: 1,
        emailId: mailId(raw.emailId),
        eventId: mailId(raw.eventId),
        attempts: Number(attempts),
      };
      pending.set(row.emailId, { row, due: clock() });
    }
  }
  const defer = (detail: EmailDetail, eventId: string) => {
    if (!pendingDirectory) return;
    if (pending.has(detail.id)) return;
    const row: Pending = {
      version: 1,
      emailId: mailId(detail.id),
      eventId: mailId(eventId),
      attempts: 0,
    };
    writeMailJson(join(pendingDirectory, `${row.emailId}.json`), row);
    pending.set(row.emailId, { row, due: clock() + (options.retryMs ?? 5000) });
  };
  const forget = (id: string) => {
    pending.delete(id);
    if (pendingDirectory)
      removeMailFile(join(pendingDirectory, `${mailId(id)}.json`));
  };
  async function currentBinding() {
    const identity = options.identity;
    if (!identity || !options.sessionKey || !options.eligible || signal.aborted)
      return null;
    const profile = loadConnectedAgentProfile(
      options.configDir,
      identity.profileName,
    );
    if (
      !profile?.presence_profile ||
      profile.api_key !== options.apiKey ||
      profile.api_base_url !== options.baseUrl ||
      profile.agent_address !== identity.agentAddress ||
      profile.owner_address !== identity.ownerAddress ||
      profile.org_id !== identity.orgId
    )
      return null;
    const setup = readMailJson(
      join(
        agentProfileDirectory(options.configDir, identity.profileName),
        "setup.json",
      ),
    );
    if (!setup || typeof setup !== "object" || Array.isArray(setup))
      return null;
    const row = setup as Record<string, unknown>;
    if (
      row.session !== options.sessionKey.split(":")[1] ||
      row.phase !== "sent" ||
      row.invitationHash !== profile.invitation_hash ||
      !(await options.eligible())
    )
      return null;
    signal.throwIfAborted();
    return profile;
  }
  async function handle(
    detail: EmailDetail,
    eventId: string,
    observedAt = clock(),
  ): Promise<PresenceDisposition> {
    const disposition = presenceDisposition(detail);
    if (disposition === "ordinary") {
      if (pending.has(detail.id) && !projection(detail)) {
        defer(detail, eventId);
        return "pending";
      }
      return knownControl(detail.id) ? "quiet" : disposition;
    }
    if (disposition === "pending") {
      defer(detail, eventId);
      return disposition;
    }
    rememberControl(detail.id);
    const proof = projection(detail);
    if (!proof || proof.valid_for_ms <= clock() - observedAt) return "quiet";
    // The exact carrier has already been authenticated by the provider. Local
    // validation also binds the downloaded canonical bytes before any reply.
    const profile = await currentBinding();
    if (!profile || !directory) return "quiet";
    if (
      detail.recipient?.toLowerCase() !== profile.agent_address ||
      detail.to_email?.toLowerCase() !== profile.agent_address ||
      detail.from_email?.toLowerCase() !==
        profile.presence_profile?.return_address
    )
      return "quiet";
    const parts = detail.parsed?.attachments;
    const part = parts?.[0];
    if (
      detail.parsed?.status !== "complete" ||
      parts?.length !== 1 ||
      !part ||
      part.filename !== "interaction.json" ||
      part.content_type?.split(";")[0]?.trim() !== "application/json" ||
      normalizePresenceText(detail.body_text) !== PRESENCE_PROBE_TEXT ||
      (detail.body_html != null && detail.body_html !== "") ||
      (detail.parsed.body_text != null &&
        normalizePresenceText(detail.parsed.body_text) !==
          PRESENCE_PROBE_TEXT) ||
      (detail.parsed.body_html != null && detail.parsed.body_html !== "") ||
      !Number.isSafeInteger(part.part_index) ||
      part.part_index === undefined ||
      part.part_index < 0 ||
      !Number.isSafeInteger(part.size_bytes) ||
      part.size_bytes < 0 ||
      part.size_bytes > MAX_PRESENCE_ENVELOPE_BYTES ||
      typeof part.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/i.test(part.sha256)
    )
      return "quiet";
    let bytes: Uint8Array;
    try {
      bytes = await notificationPartReader(
        async () => options.apiClient.client,
      )(detail.id, part.part_index, signal);
    } catch {
      defer(detail, eventId);
      return "pending";
    }
    if (
      bytes.byteLength !== part.size_bytes ||
      createHash("sha256").update(bytes).digest("hex") !==
        part.sha256.toLowerCase()
    ) {
      defer(detail, eventId);
      return "pending";
    }
    const parsed = parsePresenceEnvelope(bytes);
    if (
      parsed.status !== "valid" ||
      parsed.envelope.step !== "probe" ||
      parsed.envelope.payload.address !== profile.agent_address
    )
      return "quiet";
    const key = createHash("sha256")
      .update(parsed.envelope.interaction_id)
      .digest("hex");
    const intentDirectory = join(directory, key);
    privateMailDirectory(intentDirectory, true);
    let release: () => void;
    try {
      release = acquireListenLock(intentDirectory, "presence-reply");
    } catch (error) {
      if (!mailLockBusy(error)) throw error;
      defer(detail, eventId);
      return "pending";
    }
    try {
      const path = join(intentDirectory, "intent.json");
      const raw = readMailJson(path, 32_768);
      let intent: Intent;
      if (raw === null) {
        const result = preparePresenceAliveEmail(
          {
            accountScope: scope ?? "",
            probe: parsed.envelope,
            from: profile.agent_address,
            to: profile.presence_profile?.return_address ?? "",
            messageId: detail.message_id ?? null,
            references: detail.parsed.references ?? [],
          },
          { uuid: randomUUID, now: Date.now },
        );
        if (result.status !== "prepared") return "quiet";
        intent = { version: 1, prepared: result.prepared, phase: "prepared" };
        writeMailJson(path, intent);
      } else {
        const row = mailObject(raw, ["version", "prepared", "phase"]);
        if (
          row.version !== 1 ||
          !["prepared", "submitting", "uncertain", "sent", "declined"].includes(
            String(row.phase),
          )
        )
          throw new Error(
            "Saved presence reply is invalid; preserve it before retrying.",
          );
        const saved = row.prepared as Prepared;
        const body = JSON.parse(saved.requestJson);
        const envelope = JSON.parse(
          Buffer.from(body.attachments[0].content_base64, "base64").toString(
            "utf8",
          ),
        );
        const rebuilt = preparePresenceAliveEmail(
          {
            accountScope: scope ?? "",
            probe: parsed.envelope,
            from: profile.agent_address,
            to: profile.presence_profile?.return_address ?? "",
            messageId: detail.message_id ?? null,
            references: detail.parsed.references ?? [],
          },
          { uuid: () => envelope.step_id, now: () => saved.preparedAtMs },
        );
        if (
          rebuilt.status !== "prepared" ||
          JSON.stringify(rebuilt.prepared) !== JSON.stringify(saved)
        )
          throw new Error(
            "Saved presence reply conflicts with the current probe.",
          );
        intent = {
          version: 1,
          prepared: rebuilt.prepared,
          phase: row.phase as Intent["phase"],
        };
      }
      if (intent.phase === "sent" || intent.phase === "declined")
        return "quiet";
      if (intent.phase === "submitting" || intent.phase === "uncertain") {
        // An empty lookup cannot authorize replay. A send may still settle.
        try {
          const prior = await reconcileChatSend({
            apiClient: options.apiClient,
            idempotencyKey: intent.prepared.idempotencyKey,
            from: profile.agent_address,
            recipient: profile.presence_profile?.return_address ?? "",
            deadline: Date.now() + 5000,
          });
          if (
            prior &&
            successfulSendOutcome({
              status: prior.status,
              idempotent_replay: true,
            }) !== "uncertain"
          ) {
            intent.phase =
              successfulSendOutcome({
                status: prior.status,
                idempotent_replay: true,
              }) === "not_sent"
                ? "declined"
                : "sent";
            writeMailJson(path, intent);
            return "quiet";
          }
        } catch {
          /* Preserve unknown dispatch rather than resend. */
        }
        defer(detail, eventId);
        return "pending";
      }
      if (
        proof.valid_for_ms <= clock() - observedAt ||
        !(await currentBinding())
      )
        return "quiet";
      intent.phase = "submitting";
      writeMailJson(path, intent);
      try {
        const response = await sendEmail({
          client: options.apiClient.client,
          body: JSON.parse(intent.prepared.requestJson),
          headers: { "Idempotency-Key": intent.prepared.idempotencyKey },
          responseStyle: "fields",
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(
              Math.max(
                1,
                Math.min(5000, proof.valid_for_ms - (clock() - observedAt)),
              ),
            ),
          ]),
        });
        const sent = response.data?.data;
        intent.phase =
          !response.error && sent && successfulSendOutcome(sent) !== "uncertain"
            ? successfulSendOutcome(sent) === "not_sent"
              ? "declined"
              : "sent"
            : "uncertain";
      } catch {
        intent.phase = "uncertain";
      }
      writeMailJson(path, intent);
      if (intent.phase === "uncertain") {
        defer(detail, eventId);
        return "pending";
      }
      return "quiet";
    } finally {
      release();
    }
  }
  async function reconcile() {
    for (const item of [...pending.values()]) {
      if (signal.aborted || closed) return;
      if (item.due > clock()) continue;
      item.row.attempts = Math.min(6, item.row.attempts + 1);
      item.due =
        clock() +
        (options.retryMs ?? 5000) * (item.row.attempts === 6 ? 12 : 1);
      if (pendingDirectory)
        writeMailJson(
          join(pendingDirectory, `${item.row.emailId}.json`),
          item.row,
        );
      try {
        const observedAt = clock();
        const result = await getEmail({
          client: options.apiClient.client,
          path: { id: item.row.emailId },
          responseStyle: "fields",
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        });
        if ([401, 403].includes(result.response?.status ?? 0)) {
          stopping.abort();
          return;
        }
        const detail = result.data?.data;
        if (result.error || !detail || detail.id !== item.row.emailId) continue;
        const outcome = await handle(detail, item.row.eventId, observedAt);
        if (outcome === "pending") continue;
        if (
          outcome === "ordinary" &&
          options.onOrdinary &&
          !(await options.onOrdinary(detail, item.row.eventId))
        )
          continue;
        forget(item.row.emailId);
      } catch {
        /* Durable ID stays deferred; failure never creates a model task. */
      }
    }
  }
  const timer = setInterval(() => {
    if (!closed && !background && pending.size)
      background = reconcile().finally(() => {
        background = undefined;
      });
  }, options.retryMs ?? 5000);
  timer.unref();
  return {
    handle,
    knownControl,
    nextRetry: (id: string) => pending.get(id)?.due,
    async close() {
      closed = true;
      clearInterval(timer);
      stopping.abort();
      await background;
    },
  };
}

function normalizePresenceText(text: string | null | undefined) {
  return text?.replaceAll("\r\n", "\n").replace(/\n+$/, "");
}
