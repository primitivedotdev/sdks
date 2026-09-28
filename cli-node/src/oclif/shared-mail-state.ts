import { createHash, randomUUID } from "node:crypto";
import { opendirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ContactRequestReference } from "./contact-interactions.js";
import { listenProcessIdentity } from "./listen-state.js";
import {
  invalidSharedMail,
  mailAddress,
  mailId,
  mailObject,
  mailString,
  mailTime,
  privateMailDirectory,
  readMailJson,
  removeMailFile,
  SharedMailStateError,
  syncMailDirectory,
  withMailLock,
  writeMailJson,
} from "./shared-mail-files.js";

export type SharedMailDetails = {
  recipient: string;
  peer: string;
  replyToSentEmailId: string | null;
  receivedAt: string;
  authorization: "pending" | "trusted" | "rejected";
};
export type SharedMailWait = {
  // Missing means an older CLI owns this wait. Do not guess whether it exited.
  waiters?: SharedMailWaiter[];
  contactRequest?: ContactRequestReference;
  requestId: string;
  peer: string;
  sessionKey: string | null;
  idempotencyKey: string;
  createdAt: string;
  status: "unbound" | "uncertain" | "bound" | "completed" | "cancelled";
  sentEmailId: string | null;
};
export type SharedMailWaiter = {
  token: string;
  pid: number;
  identity: string | null;
};
export function createSharedMailWaiter(): SharedMailWaiter {
  return {
    token: randomUUID(),
    pid: process.pid,
    identity: listenProcessIdentity(process.pid),
  };
}
function waiter(value: unknown): SharedMailWaiter {
  const owner = mailObject(value, ["token", "pid", "identity"]);
  if (!Number.isSafeInteger(owner.pid) || Number(owner.pid) < 1)
    throw invalidSharedMail();
  return {
    token: mailId(owner.token),
    pid: Number(owner.pid),
    identity: owner.identity === null ? null : mailString(owner.identity),
  };
}
function mayBeWaiting(owner: SharedMailWaiter): boolean {
  const identity = listenProcessIdentity(owner.pid);
  if (identity !== null && owner.identity !== null)
    return identity === owner.identity;
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
  }
  // Unavailable process metadata or permissions cannot authorize a handoff.
  return true;
}
function addWaiters(
  previous: SharedMailWait,
  owners: SharedMailWaiter[],
): SharedMailWait {
  if (!previous.waiters) return previous;
  const merged = new Map(
    previous.waiters.filter(mayBeWaiting).map((owner) => [owner.token, owner]),
  );
  for (const input of owners) {
    const owner = waiter(input),
      existing = merged.get(owner.token);
    if (existing && !same(existing, owner)) throw invalidSharedMail();
    merged.set(owner.token, owner);
  }
  return { ...previous, waiters: [...merged.values()] };
}
export type SharedMailRoute =
  | { kind: "wait"; requestId: string; observed: boolean }
  | {
      kind: "notification";
      sessionKey: string;
      state: "selected" | "submitting" | "accepted" | "unknown" | "skipped";
    };
export type SharedMailEmail = {
  emailId: string;
  eventId: string;
  receivedAt: string;
  firstSeenAt: string;
  details: SharedMailDetails | null;
  route: SharedMailRoute | null;
};
export type SharedMailClaim = {
  status: "claimed" | "held" | "unmatched" | "already_observed";
  email: SharedMailEmail;
};
export type SharedMailPage = {
  emails: SharedMailEmail[];
  nextCursor: string | null;
};
type PageOptions = { limit?: number; cursor?: string };
type Write = { path: string; before: unknown | null; after: unknown | null };
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
function details(value: unknown): SharedMailDetails {
  const d = mailObject(value, [
    "recipient",
    "peer",
    "replyToSentEmailId",
    "receivedAt",
    "authorization",
  ]);
  if (
    d.authorization !== "pending" &&
    d.authorization !== "trusted" &&
    d.authorization !== "rejected"
  )
    throw invalidSharedMail();
  return {
    recipient: mailAddress(d.recipient),
    peer: mailAddress(d.peer),
    replyToSentEmailId:
      d.replyToSentEmailId === null ? null : mailId(d.replyToSentEmailId),
    receivedAt: mailTime(d.receivedAt),
    authorization: d.authorization,
  };
}
function wait(value: unknown): SharedMailWait {
  const hasWaiters = Boolean(
    value && typeof value === "object" && Object.hasOwn(value, "waiters"),
  );
  const hasControl = Boolean(
    value &&
      typeof value === "object" &&
      Object.hasOwn(value, "contactRequest"),
  );
  const w = mailObject(value, [
    ...(hasWaiters ? ["waiters"] : []),
    ...(hasControl ? ["contactRequest"] : []),
    "requestId",
    "peer",
    "sessionKey",
    "idempotencyKey",
    "createdAt",
    "status",
    "sentEmailId",
  ]);
  if (
    w.status !== "unbound" &&
    w.status !== "uncertain" &&
    w.status !== "bound" &&
    w.status !== "completed" &&
    w.status !== "cancelled"
  )
    throw invalidSharedMail();
  if (
    w.status !== "cancelled" &&
    (w.status === "bound" || w.status === "completed") !==
      (w.sentEmailId !== null)
  )
    throw invalidSharedMail();
  let owners: SharedMailWaiter[] | undefined;
  if (hasWaiters) {
    if (!Array.isArray(w.waiters) || w.waiters.length > 32)
      throw invalidSharedMail();
    owners = w.waiters.map(waiter);
    if (new Set(owners.map((owner) => owner.token)).size !== owners.length)
      throw invalidSharedMail();
  }
  return {
    ...(owners ? { waiters: owners } : {}),
    ...(hasControl
      ? { contactRequest: contactRequestReference(w.contactRequest) }
      : {}),
    requestId: mailId(w.requestId),
    peer: mailAddress(w.peer),
    sessionKey: w.sessionKey === null ? null : mailString(w.sessionKey),
    idempotencyKey: mailString(w.idempotencyKey),
    createdAt: mailTime(w.createdAt),
    status: w.status,
    sentEmailId: w.sentEmailId === null ? null : mailId(w.sentEmailId),
  };
}
function contactRequestReference(value: unknown): ContactRequestReference {
  const r = mailObject(value, ["interactionId", "stepId", "expiresAt"]);
  const interactionId = mailString(r.interactionId);
  const at = interactionId.indexOf("@");
  mailId(interactionId.slice(0, at));
  mailAddress(interactionId);
  return {
    interactionId,
    stepId: mailId(r.stepId),
    expiresAt: mailTime(r.expiresAt),
  };
}
function email(value: unknown): SharedMailEmail {
  const e = mailObject(value, [
    "emailId",
    "eventId",
    "receivedAt",
    "firstSeenAt",
    "details",
    "route",
  ]);
  let route: SharedMailRoute | null = null;
  if (e.route !== null) {
    const raw = e.route as Record<string, unknown>;
    if (raw.kind === "wait") {
      const r = mailObject(raw, ["kind", "requestId", "observed"]);
      if (typeof r.observed !== "boolean") throw invalidSharedMail();
      route = {
        kind: "wait",
        requestId: mailId(r.requestId),
        observed: r.observed,
      };
    } else {
      const r = mailObject(raw, ["kind", "sessionKey", "state"]);
      if (
        r.kind !== "notification" ||
        (r.state !== "selected" &&
          r.state !== "submitting" &&
          r.state !== "accepted" &&
          r.state !== "skipped" &&
          r.state !== "unknown")
      )
        throw invalidSharedMail();
      route = {
        kind: "notification",
        sessionKey: mailString(r.sessionKey),
        state: r.state,
      };
    }
  }
  return {
    emailId: mailId(e.emailId),
    eventId: mailId(e.eventId),
    receivedAt: mailTime(e.receivedAt),
    firstSeenAt: mailTime(e.firstSeenAt),
    details: e.details === null ? null : details(e.details),
    route,
  };
}
function validate(path: string, value: unknown): unknown {
  const parts = path.split("/");
  const file = parts.at(-1);
  if (!file?.endsWith(".json")) throw invalidSharedMail();
  const id = mailId(file.slice(0, -5));
  if (parts.length === 2 && parts[0] === "emails") {
    const e = email(value);
    if (e.emailId !== id) throw invalidSharedMail();
    return e;
  }
  if (parts.length === 2 && parts[0] === "waits") {
    const w = wait(value);
    if (w.requestId !== id) throw invalidSharedMail();
    return w;
  }
  if (parts.length === 2 && parts[0] === "events") {
    const r = mailObject(value, ["eventId", "emailId"]);
    if (mailId(r.eventId) !== id) throw invalidSharedMail();
    return { eventId: id, emailId: mailId(r.emailId) };
  }
  if (parts.length === 2 && parts[0] === "parents") {
    const r = mailObject(value, ["sentEmailId", "requestId"]);
    if (mailId(r.sentEmailId) !== id) throw invalidSharedMail();
    return { sentEmailId: id, requestId: mailId(r.requestId) };
  }
  if (
    parts.length === 3 &&
    parts[0] === "unbound" &&
    /^[a-f0-9]{64}$/.test(parts[1] ?? "")
  ) {
    const r = mailObject(value, ["requestId"]);
    if (mailId(r.requestId) !== id) throw invalidSharedMail();
    return { requestId: id };
  }
  if (parts.length === 3 && parts[0] === "matches") {
    const r = mailObject(value, ["emailId", "requestId"]);
    if (mailId(r.emailId) !== id || mailId(r.requestId) !== mailId(parts[1]))
      throw invalidSharedMail();
    return { emailId: id, requestId: mailId(parts[1]) };
  }
  throw invalidSharedMail();
}
function fileIds(
  directory: string,
  options: PageOptions,
): { ids: string[]; nextCursor: string | null } {
  const limit = options.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new SharedMailStateError(
      "Shared mail page limit must be between 1 and 1000.",
    );
  const cursor = options.cursor === undefined ? "" : mailId(options.cursor);
  const selected: string[] = [];
  let entries: ReturnType<typeof opendirSync>;
  try {
    privateMailDirectory(directory);
    entries = opendirSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { ids: [], nextCursor: null };
    throw error;
  }
  try {
    for (
      let item = entries.readSync();
      item !== null;
      item = entries.readSync()
    ) {
      if (item.name.startsWith(".write-")) continue;
      if (!item.isFile() || !item.name.endsWith(".json"))
        throw invalidSharedMail();
      const id = mailId(item.name.slice(0, -5));
      if (item.name !== `${id}.json`) throw invalidSharedMail();
      if (id <= cursor) continue;
      selected.push(id);
      selected.sort();
      if (selected.length > limit + 1) selected.pop();
    }
  } finally {
    entries.closeSync();
  }
  const more = selected.length > limit,
    ids = selected.slice(0, limit);
  return { ids, nextCursor: more ? (ids.at(-1) ?? null) : null };
}

/** Reserve the one local subscription before its server-verified recipient is known. */
export async function reserveSharedMailSubscription(options: {
  configDir: string;
  scope: string;
  recipient?: string;
  signal?: AbortSignal;
}) {
  options.signal?.throwIfAborted();
  const directory = join(
    options.configDir,
    "shared-mail",
    hash(mailString(options.scope, 1024)),
  );
  privateMailDirectory(directory, true);
  privateMailDirectory(dirname(directory));
  return withMailLock(
    directory,
    () => {
      const path = join(directory, "subscription.json"),
        raw = readMailJson(path);
      const requested =
        options.recipient === undefined ? null : mailAddress(options.recipient);
      let name = `local-mail-${randomUUID()}`,
        recipient: string | null = requested;
      if (raw !== null) {
        const saved = mailObject(raw, ["name", "recipient"]);
        if (
          typeof saved.name !== "string" ||
          !saved.name.startsWith("local-mail-")
        )
          throw invalidSharedMail();
        mailId(saved.name.slice("local-mail-".length));
        name = saved.name;
        const prior =
          saved.recipient === null ? null : mailAddress(saved.recipient);
        if (prior !== null && requested !== null && prior !== requested)
          throw invalidSharedMail();
        recipient = prior ?? requested;
        if (recipient !== prior) writeMailJson(path, { name, recipient });
      } else writeMailJson(path, { name, recipient });
      for (const current of [directory, dirname(directory), options.configDir])
        syncMailDirectory(current);
      return { directory, name, recipient };
    },
    options.signal,
  );
}

/** Metadata only. Callers validate exact GET recipient, authentication and ancestry before hydration. */
export async function openSharedMailStore(options: {
  configDir: string;
  scope: string;
  recipient: string;
  signal?: AbortSignal;
}) {
  options.signal?.throwIfAborted();
  const recipient = mailAddress(options.recipient);
  const reserved = await reserveSharedMailSubscription(options);
  const directory = reserved.directory;
  for (const kind of [
    "emails",
    "events",
    "waits",
    "parents",
    "unbound",
    "matches",
  ])
    privateMailDirectory(join(directory, kind), true);
  const pathFor = (kind: string, id: string) => `${kind}/${mailId(id)}.json`;
  const read = (path: string): unknown | null => {
    const parent = dirname(join(directory, path));
    try {
      privateMailDirectory(parent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    const raw = readMailJson(join(directory, path));
    return raw === null ? null : validate(path, raw);
  };
  const readEmail = (id: string) =>
    read(pathFor("emails", id)) as SharedMailEmail | null;
  const readWait = (id: string) =>
    read(pathFor("waits", id)) as SharedMailWait | null;
  const requiredEmail = (id: string) => {
    const e = readEmail(id);
    if (!e) throw invalidSharedMail();
    return e;
  };
  const requiredWait = (id: string) => {
    const w = readWait(id);
    if (!w) throw invalidSharedMail();
    return w;
  };
  function recover() {
    const raw = readMailJson(join(directory, "pending.json"), 65_536);
    if (raw === null) return;
    const pending = mailObject(raw, ["writes"]);
    if (
      !Array.isArray(pending.writes) ||
      !pending.writes.length ||
      pending.writes.length > 8
    )
      throw invalidSharedMail();
    const writes: Write[] = pending.writes.map((value) => {
      const w = mailObject(value, ["path", "before", "after"]),
        path = mailString(w.path, 200);
      const before = w.before === null ? null : validate(path, w.before),
        after = w.after === null ? null : validate(path, w.after);
      // Validate path even when deleting a currently absent record.
      if (before === null && after === null) throw invalidSharedMail();
      return { path, before, after };
    });
    if (new Set(writes.map((w) => w.path)).size !== writes.length)
      throw invalidSharedMail();
    for (const w of writes) {
      const current = read(w.path);
      if (!same(current, w.before) && !same(current, w.after))
        throw invalidSharedMail();
    }
    for (const w of writes) {
      if (w.after === null) removeMailFile(join(directory, w.path));
      else writeMailJson(join(directory, w.path), w.after);
    }
    removeMailFile(join(directory, "pending.json"));
  }
  function commit(changes: Array<{ path: string; value: unknown | null }>) {
    const writes = changes
      .map(({ path, value }) => ({
        path,
        before: read(path),
        after: value === null ? null : validate(path, value),
      }))
      .filter((w) => !same(w.before, w.after));
    if (!writes.length) return;
    writeMailJson(join(directory, "pending.json"), { writes });
    recover();
  }
  const transaction = <T>(action: () => T) =>
    withMailLock(
      directory,
      () => {
        recover();
        return action();
      },
      options.signal,
    );
  await transaction(() => {});
  const subscriptionName = reserved.name;
  const unboundPath = (w: SharedMailWait) =>
    `unbound/${hash(w.peer)}/${w.requestId}.json`;
  return {
    directory,
    subscriptionName,
    recipient,
    readEmail: (id: string) => transaction(() => readEmail(id)),
    readWait: (id: string) => transaction(() => readWait(id)),
    ingest(input: { eventId: string; emailId: string; receivedAt: string }) {
      return transaction(() => {
        const emailId = mailId(input.emailId),
          eventId = mailId(input.eventId),
          previous = readEmail(emailId);
        const eventPath = pathFor("events", eventId),
          indexed = read(eventPath) as { emailId: string } | null;
        if (indexed && (indexed.emailId !== emailId || !previous))
          throw invalidSharedMail();
        const record = previous ?? {
          emailId,
          eventId,
          receivedAt: mailTime(input.receivedAt),
          firstSeenAt: new Date().toISOString(),
          details: null,
          route: null,
        };
        commit([
          { path: pathFor("emails", emailId), value: record },
          { path: eventPath, value: { eventId, emailId } },
        ]);
        return record;
      });
    },
    hydrate(emailId: string, input: SharedMailDetails) {
      return transaction(() => {
        const record = requiredEmail(emailId),
          verified = details(input);
        if (verified.recipient !== recipient) throw invalidSharedMail();
        if (
          record.details &&
          record.details.authorization !== "pending" &&
          !same(
            record.details.replyToSentEmailId === null
              ? {
                  ...record.details,
                  replyToSentEmailId: verified.replyToSentEmailId,
                }
              : record.details,
            verified,
          )
        )
          throw invalidSharedMail();
        const next = {
          ...record,
          receivedAt: verified.receivedAt,
          details: verified,
        };
        commit([{ path: pathFor("emails", emailId), value: next }]);
        return next;
      });
    },
    registerWait(input: {
      waiter?: SharedMailWaiter;
      contactRequest?: ContactRequestReference;
      requestId: string;
      peer: string;
      sessionKey?: string | null;
      idempotencyKey: string;
      createdAt: string;
    }) {
      return transaction(() => {
        const { waiter: owner, ...registration } = input;
        const requested = wait({
            ...registration,
            ...(owner ? { waiters: [owner] } : {}),
            sessionKey: input.sessionKey ?? null,
            status: "unbound",
            sentEmailId: null,
          }),
          previous = readWait(requested.requestId);
        if (previous) {
          if (
            !same(
              {
                ...previous,
                waiters: undefined,
                status: "unbound",
                sentEmailId: null,
              },
              { ...requested, waiters: undefined },
            )
          )
            throw invalidSharedMail();
          const next = addWaiters(previous, owner ? [owner] : []);
          commit([{ path: pathFor("waits", next.requestId), value: next }]);
          return next;
        }
        commit([
          { path: pathFor("waits", requested.requestId), value: requested },
          {
            path: unboundPath(requested),
            value: { requestId: requested.requestId },
          },
        ]);
        return requested;
      });
    },
    joinWait(requestId: string, owner: SharedMailWaiter) {
      return transaction(() => {
        const previous = requiredWait(requestId);
        if (previous.status !== "bound" && previous.status !== "completed")
          throw invalidSharedMail();
        const next = addWaiters(previous, [owner]);
        commit([{ path: pathFor("waits", requestId), value: next }]);
        return next;
      });
    },
    releaseWaiter(requestId: string, token: string) {
      return transaction(() => {
        const previous = requiredWait(requestId),
          owner = mailId(token);
        const records = [previous];
        if (previous.status === "cancelled" && previous.sentEmailId) {
          const parent = read(pathFor("parents", previous.sentEmailId)) as {
            requestId: string;
          } | null;
          if (parent && parent.requestId !== previous.requestId)
            records.push(requiredWait(parent.requestId));
        }
        const changes = records
          .filter((record) => record.waiters)
          .map((record) => ({
            path: pathFor("waits", record.requestId),
            value: {
              ...record,
              waiters: record.waiters?.filter((entry) => entry.token !== owner),
            },
          }));
        commit(changes);
        return requiredWait(requestId);
      });
    },
    findWaitByParent(sentEmailId: string) {
      return transaction(() => {
        const parent = read(pathFor("parents", sentEmailId)) as {
          requestId: string;
        } | null;
        return parent === null ? null : requiredWait(parent.requestId);
      });
    },
    bindWait(requestId: string, sentEmailId: string) {
      return transaction(() => {
        const previous = requiredWait(requestId),
          parent = mailId(sentEmailId),
          parentPath = pathFor("parents", parent);
        const occupied = read(parentPath) as { requestId: string } | null;
        if (previous.sentEmailId !== null && previous.sentEmailId !== parent)
          throw invalidSharedMail();
        if (occupied && occupied.requestId !== previous.requestId) {
          const canonical = requiredWait(occupied.requestId);
          if (
            canonical.sentEmailId !== parent ||
            canonical.peer !== previous.peer ||
            !same(
              canonical.contactRequest ?? null,
              previous.contactRequest ?? null,
            )
          )
            throw invalidSharedMail();
          if (canonical.status === "bound") {
            // A standalone resume joins the original claim rather than leaving a second peer hold.
            if (
              previous.status !== "unbound" &&
              previous.status !== "cancelled"
            )
              throw invalidSharedMail();
            const joined = previous.waiters
              ? addWaiters(canonical, previous.waiters)
              : { ...canonical, waiters: undefined };
            // A legacy waiter cannot be tracked. Retain its conservative hold.
            if (joined.waiters === undefined) delete joined.waiters;
            commit([
              { path: pathFor("waits", canonical.requestId), value: joined },
              {
                path: pathFor("waits", requestId),
                value: {
                  ...previous,
                  ...(previous.waiters ? { waiters: [] } : {}),
                  status: "cancelled",
                  sentEmailId: parent,
                },
              },
              { path: unboundPath(previous), value: null },
            ]);
            return joined;
          }
          if (canonical.status !== "completed") throw invalidSharedMail();
        }
        if (previous.status === "cancelled" || previous.status === "completed")
          throw invalidSharedMail();
        const next: SharedMailWait = {
          ...previous,
          status: "bound",
          sentEmailId: parent,
        };
        commit([
          { path: pathFor("waits", requestId), value: next },
          {
            path: parentPath,
            value: { sentEmailId: parent, requestId: previous.requestId },
          },
          { path: unboundPath(previous), value: null },
        ]);
        return next;
      });
    },
    cancelWaitBeforeSend(requestId: string) {
      return transaction(() => {
        const previous = requiredWait(requestId);
        if (
          previous.status !== "unbound" &&
          !(previous.status === "cancelled" && previous.sentEmailId === null)
        )
          throw invalidSharedMail();
        const next: SharedMailWait = { ...previous, status: "cancelled" };
        commit([
          { path: pathFor("waits", requestId), value: next },
          { path: unboundPath(previous), value: null },
        ]);
        return next;
      });
    },
    // Only the send outcome classifier may authorize this post-attempt cleanup.
    cancelRejectedSend(requestId: string) {
      return transaction(() => {
        const previous = requiredWait(requestId);
        if (
          previous.sentEmailId !== null ||
          !["unbound", "uncertain", "cancelled"].includes(previous.status)
        )
          throw invalidSharedMail();
        const next: SharedMailWait = { ...previous, status: "cancelled" };
        commit([
          { path: pathFor("waits", requestId), value: next },
          { path: unboundPath(previous), value: null },
        ]);
        return next;
      });
    },
    finishWait(requestId: string) {
      return transaction(() => {
        const previous = requiredWait(requestId);
        if (previous.status === "completed") return previous;
        if (previous.status !== "bound") throw invalidSharedMail();
        let observed = 0,
          cursor: string | undefined;
        do {
          const page = fileIds(join(directory, "matches", previous.requestId), {
            cursor,
          });
          for (const id of page.ids) {
            if (read(`matches/${previous.requestId}/${id}.json`) === null)
              throw invalidSharedMail();
            const r = requiredEmail(id).route;
            if (
              r?.kind !== "wait" ||
              r.requestId !== previous.requestId ||
              !r.observed
            )
              throw invalidSharedMail();
            observed++;
          }
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        if (!observed) throw invalidSharedMail();
        const next: SharedMailWait = { ...previous, status: "completed" };
        commit([{ path: pathFor("waits", requestId), value: next }]);
        return next;
      });
    },
    markWaitUncertain(requestId: string) {
      return transaction(() => {
        const previous = requiredWait(requestId);
        if (previous.status !== "unbound" && previous.status !== "uncertain")
          throw invalidSharedMail();
        const next: SharedMailWait = { ...previous, status: "uncertain" };
        commit([{ path: pathFor("waits", requestId), value: next }]);
        return next;
      });
    },
    claimForWait(
      emailId: string,
      requestId: string,
      token?: string,
    ): Promise<SharedMailClaim> {
      return transaction(() => {
        const record = requiredEmail(emailId),
          w = requiredWait(requestId);
        if (
          w.waiters &&
          !w.waiters.some(
            (owner) => owner.token === token && mayBeWaiting(owner),
          )
        )
          return { status: "held", email: record };
        if (record.route)
          return {
            status:
              record.route.kind === "wait" &&
              record.route.requestId === w.requestId
                ? record.route.observed
                  ? "already_observed"
                  : "claimed"
                : "held",
            email: record,
          };
        if (
          !record.details ||
          record.details.authorization === "pending" ||
          w.status !== "bound"
        )
          return { status: "held", email: record };
        if (
          record.details.authorization !== "trusted" ||
          record.details.peer !== w.peer ||
          record.details.replyToSentEmailId !== w.sentEmailId
        )
          return { status: "unmatched", email: record };
        const next: SharedMailEmail = {
          ...record,
          route: { kind: "wait", requestId: w.requestId, observed: false },
        };
        commit([
          { path: pathFor("emails", emailId), value: next },
          {
            path: `matches/${w.requestId}/${record.emailId}.json`,
            value: { emailId: record.emailId, requestId: w.requestId },
          },
        ]);
        return { status: "claimed", email: next };
      });
    },
    markWaitObserved(emailId: string, requestId: string) {
      return transaction(() => {
        const record = requiredEmail(emailId);
        if (
          record.route?.kind !== "wait" ||
          record.route.requestId !== mailId(requestId)
        )
          throw invalidSharedMail();
        const next = { ...record, route: { ...record.route, observed: true } };
        commit([{ path: pathFor("emails", emailId), value: next }]);
        return next;
      });
    },
    claimForNotification(
      emailId: string,
      sessionKey: string,
    ): Promise<SharedMailClaim> {
      return transaction(() => {
        const record = requiredEmail(emailId),
          session = mailString(sessionKey),
          d = record.details;
        if (record.route)
          return {
            status:
              record.route.kind === "notification" &&
              record.route.state === "skipped"
                ? "already_observed"
                : record.route.kind === "notification" &&
                    record.route.sessionKey === session
                  ? record.route.state === "selected"
                    ? "claimed"
                    : record.route.state === "accepted"
                      ? "already_observed"
                      : "held"
                  : "held",
            email: record,
          };
        if (!d || d.authorization === "pending")
          return { status: "held", email: record };
        if (d.authorization !== "trusted")
          return { status: "unmatched", email: record };
        if (d.replyToSentEmailId) {
          const parent = read(pathFor("parents", d.replyToSentEmailId)) as {
            requestId: string;
          } | null;
          if (parent) {
            const w = requiredWait(parent.requestId);
            if (w.sentEmailId !== d.replyToSentEmailId)
              throw invalidSharedMail();
            if (
              w.status === "bound" &&
              w.peer === d.peer &&
              (!w.waiters || w.waiters.some(mayBeWaiting))
            )
              return { status: "held", email: record };
          }
        }
        let cursor: string | undefined;
        do {
          const page = fileIds(join(directory, "unbound", hash(d.peer)), {
            cursor,
          });
          for (const id of page.ids) {
            if (read(`unbound/${hash(d.peer)}/${id}.json`) === null)
              throw invalidSharedMail();
            const w = requiredWait(id);
            if (
              w.peer !== d.peer ||
              (w.status !== "unbound" && w.status !== "uncertain")
            )
              throw invalidSharedMail();
            // An unresolved send has no authoritative parent yet. A clock jump
            // or timeout must never turn its possible reply into a native turn.
            return { status: "held", email: record };
          }
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        const next: SharedMailEmail = {
          ...record,
          route: {
            kind: "notification",
            sessionKey: session,
            state: "selected",
          },
        };
        commit([{ path: pathFor("emails", emailId), value: next }]);
        return { status: "claimed", email: next };
      });
    },
    releaseNotification(emailId: string, sessionKey: string) {
      return transaction(() => {
        const record = requiredEmail(emailId),
          route = record.route;
        if (
          route?.kind !== "notification" ||
          route.sessionKey !== mailString(sessionKey) ||
          route.state !== "selected"
        )
          throw invalidSharedMail();
        const next: SharedMailEmail = { ...record, route: null };
        commit([{ path: pathFor("emails", emailId), value: next }]);
        return next;
      });
    },
    skipNotification(emailId: string, sessionKey: string) {
      return transaction(() => {
        const record = requiredEmail(emailId),
          route = record.route;
        if (
          route?.kind !== "notification" ||
          route.sessionKey !== mailString(sessionKey) ||
          (route.state !== "selected" && route.state !== "skipped")
        )
          throw invalidSharedMail();
        const next: SharedMailEmail = {
          ...record,
          route: { ...route, state: "skipped" },
        };
        commit([{ path: pathFor("emails", emailId), value: next }]);
        return next;
      });
    },
    markNotification(
      emailId: string,
      state: "submitting" | "accepted" | "unknown",
    ) {
      return transaction(() => {
        const record = requiredEmail(emailId),
          route = record.route;
        if (
          route?.kind !== "notification" ||
          !["submitting", "accepted", "unknown"].includes(state) ||
          (route.state === "selected" && state !== "submitting") ||
          (route.state !== "selected" &&
            route.state !== "submitting" &&
            route.state !== state)
        )
          throw invalidSharedMail();
        const next: SharedMailEmail = { ...record, route: { ...route, state } };
        commit([{ path: pathFor("emails", emailId), value: next }]);
        return next;
      });
    },
    listEmails(options: PageOptions = {}): Promise<SharedMailPage> {
      return transaction(() => {
        const page = fileIds(join(directory, "emails"), options);
        return {
          emails: page.ids.map(requiredEmail),
          nextCursor: page.nextCursor,
        };
      });
    },
    listWaitEmails(
      requestId: string,
      options: PageOptions = {},
    ): Promise<SharedMailPage> {
      return transaction(() => {
        const request = mailId(requestId),
          page = fileIds(join(directory, "matches", request), options);
        const emails = page.ids.map((id) => {
          if (read(`matches/${request}/${id}.json`) === null)
            throw invalidSharedMail();
          const e = requiredEmail(id);
          if (e.route?.kind !== "wait" || e.route.requestId !== request)
            throw invalidSharedMail();
          return e;
        });
        return { emails, nextCursor: page.nextCursor };
      });
    },
  };
}
export type SharedMailStore = Awaited<ReturnType<typeof openSharedMailStore>>;
