import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const CHAT_STATE_FILE = "chat-state.json";
const CHAT_STATE_VERSION = 2;
const MAX_CONVERSATIONS = 50;

export type ChatConversationState = {
  from: string;
  last_reply_email_id: string;
  last_reply_received_at: string;
  last_sent_email_id: string;
  local_id: number;
  recipient: string;
  strict_only: boolean;
  strict_phase_seconds: number;
  thread_id: string | null;
  timeout_seconds: number;
  updated_at: string;
};

export type ChatState = {
  active_local_id: number | null;
  conversations: ChatConversationState[];
  next_local_id: number;
  version: typeof CHAT_STATE_VERSION;
};

export type ChatConversationStateInput = Omit<
  ChatConversationState,
  "local_id" | "updated_at"
> & {
  updated_at?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function parseLocalId(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
    ? value
    : null;
}

export function chatStatePath(configDir: string): string {
  return join(configDir, CHAT_STATE_FILE);
}

export function deleteChatState(configDir: string): void {
  rmSync(chatStatePath(configDir), { force: true });
}

export function chatConversationState(params: {
  input: ChatConversationStateInput;
  localId: number;
}): ChatConversationState {
  return {
    ...params.input,
    local_id: params.localId,
    updated_at: params.input.updated_at ?? new Date().toISOString(),
  };
}

function parseConversation(raw: unknown): ChatConversationState | null {
  if (!isRecord(raw)) return null;

  const localId = parseLocalId(raw.local_id);
  const recipient = nonEmptyString(raw.recipient);
  const from = nonEmptyString(raw.from);
  const lastReplyEmailId = nonEmptyString(raw.last_reply_email_id);
  const lastSentEmailId = nonEmptyString(raw.last_sent_email_id);
  const lastReplyReceivedAt = nonEmptyString(raw.last_reply_received_at);
  const updatedAt = nonEmptyString(raw.updated_at);
  const timeoutSeconds = nonNegativeInteger(raw.timeout_seconds);
  const strictPhaseSeconds = positiveInteger(raw.strict_phase_seconds);
  if (
    localId === null ||
    !recipient ||
    !from ||
    !lastReplyEmailId ||
    !lastSentEmailId ||
    !lastReplyReceivedAt ||
    !updatedAt ||
    timeoutSeconds === null ||
    strictPhaseSeconds === null ||
    typeof raw.strict_only !== "boolean"
  ) {
    return null;
  }
  const threadId =
    raw.thread_id !== null && raw.thread_id !== undefined
      ? nonEmptyString(raw.thread_id)
      : null;
  if (raw.thread_id !== null && raw.thread_id !== undefined && !threadId) {
    return null;
  }

  return {
    from,
    last_reply_email_id: lastReplyEmailId,
    last_reply_received_at: lastReplyReceivedAt,
    last_sent_email_id: lastSentEmailId,
    local_id: localId,
    recipient,
    strict_only: raw.strict_only,
    strict_phase_seconds: strictPhaseSeconds,
    thread_id: threadId,
    timeout_seconds: timeoutSeconds,
    updated_at: updatedAt,
  };
}

function parseLegacyActiveState(raw: unknown): ChatState | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  const legacy = parseConversation({ ...raw, local_id: 0 });
  if (!legacy) return null;
  return {
    active_local_id: 0,
    conversations: [legacy],
    next_local_id: 1,
    version: CHAT_STATE_VERSION,
  };
}

export function parseChatState(raw: unknown): ChatState | null {
  if (!isRecord(raw)) return null;
  if (raw.version === 1) return parseLegacyActiveState(raw);
  if (raw.version !== CHAT_STATE_VERSION) return null;
  if (!Array.isArray(raw.conversations)) return null;

  const conversations = raw.conversations
    .map((entry) => parseConversation(entry))
    .filter((entry): entry is ChatConversationState => entry !== null);
  if (conversations.length !== raw.conversations.length) return null;

  const ids = new Set<number>();
  for (const conversation of conversations) {
    if (ids.has(conversation.local_id)) return null;
    ids.add(conversation.local_id);
  }

  const activeLocalId =
    raw.active_local_id === null ? null : parseLocalId(raw.active_local_id);
  if (activeLocalId === null && raw.active_local_id !== null) return null;
  if (activeLocalId !== null && !ids.has(activeLocalId)) return null;

  const nextLocalId = nonNegativeInteger(raw.next_local_id) ?? 0;
  return {
    active_local_id: activeLocalId,
    conversations,
    next_local_id: Math.max(
      nextLocalId,
      ...conversations.map((conversation) => conversation.local_id + 1),
      0,
    ),
    version: CHAT_STATE_VERSION,
  };
}

export function loadChatState(configDir: string): ChatState | null {
  let contents: string;
  try {
    contents = readFileSync(chatStatePath(configDir), "utf8");
  } catch {
    return null;
  }

  try {
    return parseChatState(JSON.parse(contents));
  } catch {
    return null;
  }
}

export function loadActiveChatState(
  configDir: string,
): ChatConversationState | null {
  const state = loadChatState(configDir);
  if (state?.active_local_id === null || state === null) return null;
  return (
    state.conversations.find(
      (conversation) => conversation.local_id === state.active_local_id,
    ) ?? null
  );
}

export function loadChatConversationByLocalId(
  configDir: string,
  localId: number,
): ChatConversationState | null {
  const state = loadChatState(configDir);
  return (
    state?.conversations.find(
      (conversation) => conversation.local_id === localId,
    ) ?? null
  );
}

function saveChatState(configDir: string, state: ChatState): void {
  mkdirSync(configDir, { mode: 0o700, recursive: true });
  const path = chatStatePath(configDir);
  const tempPath = join(
    configDir,
    `${CHAT_STATE_FILE}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

function compareConversationUpdatedAt(
  left: ChatConversationState,
  right: ChatConversationState,
): number {
  return right.updated_at.localeCompare(left.updated_at);
}

export function saveActiveChatState(
  configDir: string,
  input: ChatConversationStateInput,
  options: { preferredLocalId?: number } = {},
): ChatConversationState {
  const existing = loadChatState(configDir) ?? {
    active_local_id: null,
    conversations: [],
    next_local_id: 0,
    version: CHAT_STATE_VERSION,
  };

  const existingByPreferredId =
    options.preferredLocalId === undefined
      ? undefined
      : existing.conversations.find(
          (conversation) => conversation.local_id === options.preferredLocalId,
        );
  const existingByThread =
    input.thread_id === null
      ? undefined
      : existing.conversations.find(
          (conversation) => conversation.thread_id === input.thread_id,
        );
  const localId =
    existingByPreferredId?.local_id ??
    existingByThread?.local_id ??
    existing.next_local_id;
  const conversation = chatConversationState({
    input,
    localId,
  });

  const conversations = [
    conversation,
    ...existing.conversations.filter((item) => item.local_id !== localId),
  ]
    .sort(compareConversationUpdatedAt)
    .slice(0, MAX_CONVERSATIONS);

  const activeStillPresent = conversations.some(
    (item) => item.local_id === localId,
  );
  const nextLocalId = Math.max(
    existing.next_local_id,
    localId + 1,
    ...conversations.map((item) => item.local_id + 1),
  );

  saveChatState(configDir, {
    active_local_id: activeStillPresent ? localId : null,
    conversations,
    next_local_id: nextLocalId,
    version: CHAT_STATE_VERSION,
  });

  return conversation;
}
