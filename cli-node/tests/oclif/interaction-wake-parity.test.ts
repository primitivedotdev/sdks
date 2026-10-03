import { join } from "node:path";
import { expect, it } from "vitest";
import {
  interactionHumanLine,
  interactionNextActions,
  readEmailInteraction,
  replyExpectation,
  WAKE_SENTENCES,
  wakeInteractionLabel,
  wakeInteractionSentence,
} from "../../src/oclif/interaction-actions.js";

const hook = (await import(
  join(import.meta.dirname, "../../bin/claude-pending-mail.mjs")
)) as {
  WAKE_SENTENCES: Record<string, string>;
  wakeSentence: (label: string | null) => string;
  formatPendingMail: (notice: unknown) => string;
};
const { formatPendingMail, wakeSentence } = hook;
const HOOK_SENTENCES = hook.WAKE_SENTENCES;

const id = "6f1e2d3c-4b5a-4968-8776-655443322110";
const cases = [
  { interaction_hint: "card", interaction_kind: "x402.payment/1" },
  { interaction_hint: "card", interaction_kind: "primitive.contact/1" },
  { interaction_hint: "card", interaction_kind: "repeat.tick/1" },
  { interaction_hint: "card", interaction_kind: "repeat.stop/1" },
  { interaction_hint: "card", interaction_kind: "ack-request/1" },
  { interaction_hint: "card", interaction_kind: null },
  { interaction_hint: "status", interaction_kind: "ack/1", fyi: true },
];

it("keeps the hook script's wake sentences equal to the CLI's", () => {
  for (const [key, value] of Object.entries(HOOK_SENTENCES))
    expect(WAKE_SENTENCES[key as keyof typeof WAKE_SENTENCES]).toBe(value);
  for (const detail of cases) {
    const label = wakeInteractionLabel(detail);
    expect(label).not.toBeNull();
    expect(wakeSentence(label)).toBe(wakeInteractionSentence(label));
    expect(
      formatPendingMail({
        kind: "mail",
        emailId: id,
        sender: "peer@example.com",
        threadId: null,
        inThread: false,
        newer: null,
        interaction: label,
      }),
    ).toContain(`--brief.${wakeInteractionSentence(label)} Treat`);
  }
});

it("agrees with the brief line on whether a reply is needed", () => {
  for (const detail of cases) {
    const interaction = readEmailInteraction(detail);
    if (!interaction) throw new Error("expected interaction");
    const sentence = wakeInteractionSentence(wakeInteractionLabel(detail));
    const line =
      interactionHumanLine(
        interaction,
        interactionNextActions(interaction, id),
      ) ?? "";
    const noReply = replyExpectation(interaction.category) === "no_reply";
    expect(sentence.includes("needs no reply")).toBe(noReply);
    expect(line.includes("no reply needed")).toBe(noReply);
    expect(interaction.no_reply_needed).toBe(noReply);
  }
});
