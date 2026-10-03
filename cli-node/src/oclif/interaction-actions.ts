import { buildFollowUpCommand, type FollowUpCommand } from "./send-outcome.js";

/**
 * What a received email asks of the reader, and the command that answers it.
 *
 * Everything here is derived from fields the server decides: `interaction_hint`
 * and `interaction_kind` (set only from a DKIM-authenticated `interaction.json`
 * part) and `fyi`. The `X-Primitive-Interaction` header, part filenames, the
 * subject and the body are never consulted, so a sender cannot make an
 * ordinary email look like an interaction, or the reverse.
 */

export type InteractionHint = "status" | "card" | "none" | "pending";

export type InteractionCategory =
  /** Ordinary mail: a reply answers it. */
  | "ordinary"
  /** Informational (`fyi`): needs no reply, not even another fyi. */
  | "fyi"
  /** A status signal (read, working, typing, ack): needs no reply. */
  | "signal"
  /** `x402.payment/1`: answered by the payments commands. */
  | "payment"
  /** `primitive.contact/1`: answered by `contacts accept`. */
  | "contact"
  /** `repeat.tick/1`: a repeating message; `repeat stop` ends it. */
  | "repeat"
  /** `repeat.stop/1`: notice that a repeat ended; needs no reply. */
  | "repeat_stopped"
  /** Any other interaction: this CLI cannot answer it. */
  | "unsupported"
  /** The server has not finished checking the email for an interaction. */
  | "pending";

export type EmailInteraction = {
  hint: InteractionHint;
  /** `<protocol>/<version>`, or null when the server reported none. */
  kind: string | null;
  fyi: boolean;
  category: InteractionCategory;
  /** Whether a plain `primitive reply` is a complete answer. */
  plain_reply_completes: boolean;
  /** Whether no answer at all is needed. */
  no_reply_needed: boolean;
};

export type NextActionKind =
  | "reply"
  | "inspect_payment"
  | "pay"
  | "accept_contact"
  | "stop_repeat"
  | "read_again";

export type NextAction = FollowUpCommand<NextActionKind>;

const HINTS = new Set<InteractionHint>(["status", "card", "none", "pending"]);
/** A printable `<protocol>/<version>`; anything else is treated as unknown. */
const KIND = /^[a-z][a-z0-9._-]{0,63}\/[1-9][0-9]{0,3}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function categoryOf(
  hint: InteractionHint,
  kind: string | null,
  fyi: boolean,
  candidate: boolean,
): InteractionCategory {
  if (hint === "pending") return candidate ? "pending" : "ordinary";
  if (hint === "card") {
    switch (kind) {
      case "x402.payment/1":
        return "payment";
      case "primitive.contact/1":
        return "contact";
      case "repeat.tick/1":
        return "repeat";
      case "repeat.stop/1":
        return "repeat_stopped";
      default:
        return "unsupported";
    }
  }
  if (fyi) return "fyi";
  if (hint === "status") return "signal";
  return "ordinary";
}

/**
 * What answering an email of a category takes. The single source for the
 * brief and `inbox next` lines, the `inbox next` footer, the wake sentence
 * and the reply warning, so they cannot disagree.
 */
export type ReplyExpectation =
  /** A plain reply answers it (ordinary mail). */
  | "reply"
  /** Nothing is needed: fyi, status signals, repeat-stopped notices. */
  | "no_reply"
  /** A dedicated command answers it; a plain reply does not. */
  | "answer_with_command"
  /** A repeating message: reply if needed, stop it with its own command. */
  | "repeat"
  /** An interaction this CLI cannot answer; a plain reply does not complete it. */
  | "unsupported"
  /** The server has not finished checking it; read it again. */
  | "read_again";

export function replyExpectation(
  category: InteractionCategory,
): ReplyExpectation {
  switch (category) {
    case "fyi":
    case "signal":
    case "repeat_stopped":
      return "no_reply";
    case "payment":
    case "contact":
      return "answer_with_command";
    case "repeat":
      return "repeat";
    case "unsupported":
      return "unsupported";
    case "pending":
      return "read_again";
    default:
      return "reply";
  }
}

/**
 * The server's interaction facts for an email read, or null when the server
 * did not report `interaction_hint` (an older server). An unfamiliar hint is
 * treated as `none`, as the API documents.
 */
export function readEmailInteraction(detail: unknown): EmailInteraction | null {
  const row = record(detail);
  if (!row || typeof row.interaction_hint !== "string") return null;
  const hint = HINTS.has(row.interaction_hint as InteractionHint)
    ? (row.interaction_hint as InteractionHint)
    : "none";
  const rawKind = row.interaction_kind;
  const kind =
    (hint === "card" || hint === "status") &&
    typeof rawKind === "string" &&
    KIND.test(rawKind)
      ? rawKind
      : null;
  const fyi = row.fyi === true || record(row.collaboration)?.fyi === true;
  const category = categoryOf(
    hint,
    kind,
    fyi,
    row.interaction_candidate === true,
  );
  const expectation = replyExpectation(category);
  return {
    hint,
    kind,
    fyi,
    category,
    plain_reply_completes: expectation === "reply" || expectation === "repeat",
    no_reply_needed: expectation === "no_reply",
  };
}

function replyAction(bin: string, id: string): NextAction {
  return buildFollowUpCommand(
    "reply",
    "Reply to the sender",
    [bin, "reply", "--id", id, "--body", "<message>"],
    { requiresMessage: true },
  );
}

/**
 * The commands that answer an email, best first. Empty when the email needs
 * no reply or this CLI cannot answer it. `repeatStoppable: false` (the
 * repeat's own part says only the sender can stop it) leaves out the stop.
 */
export function interactionNextActions(
  interaction: EmailInteraction | null,
  emailId: string,
  options: { bin?: string; repeatStoppable?: boolean | null } = {},
): NextAction[] {
  const bin = options.bin ?? "primitive";
  if (!UUID.test(emailId)) return [];
  const id = emailId.toLowerCase();
  switch (interaction?.category ?? "ordinary") {
    case "ordinary":
      return [replyAction(bin, id)];
    case "payment":
      return [
        buildFollowUpCommand(
          "inspect_payment",
          "Show the payment request's terms before paying",
          [bin, "payments", "challenge-from-email", "--id", id],
        ),
        buildFollowUpCommand(
          "pay",
          "Pay the payment request (signs with your wallet key and sends the payment)",
          [bin, "payments", "pay-email", "--in-reply-to", id],
        ),
      ];
    case "contact":
      return [
        buildFollowUpCommand(
          "accept_contact",
          "Accept the contact request, if the owner's policy allows it",
          [bin, "contacts", "accept", "--id", id],
        ),
      ];
    case "repeat": {
      const actions = [replyAction(bin, id)];
      // The same command the SDK's repeatStopCommand names.
      if (options.repeatStoppable !== false)
        actions.push(
          buildFollowUpCommand(
            "stop_repeat",
            "Stop the repeating message once its goal is met",
            [bin, "repeat", "stop", "--id", id],
          ),
        );
      return actions;
    }
    case "pending":
      return [
        buildFollowUpCommand(
          "read_again",
          "Read the email again once the server has finished checking it",
          [bin, "emails", "get", "--id", id, "--brief"],
        ),
      ];
    default:
      return [];
  }
}

/**
 * One human line naming how to answer the email, or null for ordinary mail
 * (and older servers), where `primitive reply` is the answer. Contains only
 * server-decided values and fixed text, never anything the sender wrote.
 */
export function interactionHumanLine(
  interaction: EmailInteraction | null,
  actions: NextAction[],
): string | null {
  if (!interaction) return null;
  const command = (kind: NextActionKind) =>
    actions.find((action) => action.kind === kind)?.command;
  const kind = interaction.kind ?? "unknown kind";
  switch (interaction.category) {
    case "fyi":
      return "Informational (fyi): no reply needed, not even another fyi.";
    case "signal":
      return `Status signal (${kind}): no reply needed.`;
    case "repeat_stopped":
      return `Notice that a repeating message stopped (${kind}): no reply needed.`;
    case "payment": {
      const inspect = command("inspect_payment");
      const pay = command("pay");
      return inspect && pay
        ? `Payment interaction (${kind}). If it requests payment, review it with ${inspect} and pay with ${pay}. A plain reply does not pay or decline it.`
        : null;
    }
    case "contact": {
      const accept = command("accept_contact");
      return accept
        ? `Contact interaction (${kind}). If it is a contact request, accept it under the owner's policy with ${accept}. A plain reply does not accept it.`
        : null;
    }
    case "repeat": {
      const stop = command("stop_repeat");
      return stop
        ? `Repeating message (${kind}). Reply if it asks for an answer; stop it once its goal is met with ${stop}.`
        : `Repeating message (${kind}). Reply if it asks for an answer; only the sender can stop it.`;
    }
    case "unsupported":
      return `Interaction (${kind}) that this CLI cannot answer. A plain reply does not complete it.`;
    case "pending": {
      const again = command("read_again");
      return again
        ? `Primitive has not finished checking this email for an interaction. Read it again before answering: ${again}`
        : null;
    }
    default:
      return null;
  }
}

/** The label a wake notice carries: the interaction kind, `fyi`, or null. */
export function wakeInteractionLabel(detail: unknown): string | null {
  const interaction = readEmailInteraction(detail);
  if (!interaction) return null;
  if (interaction.hint === "card") return interaction.kind ?? "unknown";
  if (interaction.fyi) return "fyi";
  return null;
}

/** The category a wake label stands for, or null for an invalid label. */
export function wakeLabelCategory(label: unknown): InteractionCategory | null {
  if (!isWakeInteractionLabel(label)) return null;
  if (label === "fyi") return "fyi";
  return categoryOf("card", label === "unknown" ? null : label, false, false);
}

/**
 * The fixed wake sentences, keyed by reply expectation. The Claude hook
 * scripts in bin/ carry copies (they run standalone); a test keeps them equal.
 */
export const WAKE_SENTENCES: Record<ReplyExpectation, string> = {
  reply: "",
  read_again: "",
  no_reply: " It needs no reply.",
  answer_with_command:
    " It is an interaction a plain reply does not complete; the brief names the command that answers it.",
  repeat:
    " It is a repeating message; the brief says how to answer it and whether you can stop it.",
  unsupported:
    " It is an interaction this CLI cannot answer; a plain reply does not complete it.",
};

/**
 * The sentence a wake line adds after its read command for an interaction
 * label: empty for ordinary mail and for anything that is not a valid label.
 */
export function wakeInteractionSentence(label: unknown): string {
  const category = wakeLabelCategory(label);
  return category ? WAKE_SENTENCES[replyExpectation(category)] : "";
}

/** Accepts only labels `wakeInteractionLabel` can produce. */
export function isWakeInteractionLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value === "fyi" || value === "unknown" || KIND.test(value))
  );
}

export type InteractionWarning = {
  code: "interaction_not_answered" | "reply_not_needed";
  email_id: string;
  kind: string | null;
  category: InteractionCategory;
  message: string;
  /** The commands that answer the email instead; empty when none is needed. */
  expected: NextAction[];
};

/**
 * Warning for a plain (prose) reply to `detail`, or null when a plain reply
 * is a fine answer. Never refuses: the caller still sends.
 */
export function replyInteractionWarning(
  detail: unknown,
  emailId: string,
): InteractionWarning | null {
  const interaction = readEmailInteraction(detail);
  if (!interaction || !UUID.test(emailId)) return null;
  const id = emailId.toLowerCase();
  const kind = interaction.kind;
  const label = kind ?? "unknown kind";
  const base = { email_id: id, kind, category: interaction.category };
  const expected = interactionNextActions(interaction, id);
  const commandFor = (actionKind: NextActionKind) =>
    expected.find((action) => action.kind === actionKind)?.command;
  const expectation = replyExpectation(interaction.category);
  if (expectation === "reply" || expectation === "repeat") return null;
  switch (interaction.category) {
    case "payment":
      return {
        ...base,
        code: "interaction_not_answered",
        message: `Warning: email ${id} is a payment interaction (${label}). A plain reply does not pay or decline it; sending anyway. To pay: ${commandFor("pay")}`,
        expected,
      };
    case "contact":
      return {
        ...base,
        code: "interaction_not_answered",
        message: `Warning: email ${id} is a contact interaction (${label}). A plain reply does not accept it; sending anyway. To accept: ${commandFor("accept_contact")}`,
        expected,
      };
    case "unsupported":
      return {
        ...base,
        code: "interaction_not_answered",
        message: `Warning: email ${id} is an interaction (${label}) that this CLI cannot answer. A plain reply does not complete it; sending anyway.`,
        expected,
      };
    case "fyi":
      return {
        ...base,
        code: "reply_not_needed",
        message: `Warning: email ${id} is informational (fyi) and needs no reply; sending anyway.`,
        expected,
      };
    case "signal":
      return {
        ...base,
        code: "reply_not_needed",
        message: `Warning: email ${id} is a status signal (${label}) and needs no reply; sending anyway.`,
        expected,
      };
    case "repeat_stopped":
      return {
        ...base,
        code: "reply_not_needed",
        message: `Warning: email ${id} is a notice that a repeating message stopped (${label}) and needs no reply; sending anyway.`,
        expected,
      };
    default:
      return null;
  }
}
