import type { EmailReceivedEvent, UnderstandingRule } from "../types.js";
import type { ReceivedEmail } from "./received-email.js";

/**
 * The rules that matched an email and granted its delivery, read from
 * `email.analysis.understanding.rules`.
 *
 * Takes the event `handleWebhook()` returns or the {@link ReceivedEmail} that
 * `receive()` and `normalizeReceivedEmail()` return. Returns an empty array
 * when the delivery was not granted by a rule or the email carries no
 * understanding. Entries without a rule id are skipped. Pass `ruleId` to keep
 * only the entries for that rule; `undefined` or `null` keeps every rule.
 *
 * @example
 * ```typescript
 * const email = await primitive.receive(req, { secret });
 * for (const rule of matchedRules(email)) {
 *   console.log(rule.id, rule.name, rule.explanation);
 * }
 * const isApplicant = matchedRules(email, applicantsRuleId).length > 0;
 * ```
 */
export function matchedRules(
  email: EmailReceivedEvent | ReceivedEmail,
  ruleId?: string | null,
): UnderstandingRule[] {
  const analysis = "email" in email ? email.email.analysis : email.analysis;
  const rules: unknown = analysis?.understanding?.rules;
  if (!Array.isArray(rules)) {
    return [];
  }
  return rules.filter(
    (rule): rule is UnderstandingRule =>
      hasRuleId(rule) && (ruleId == null || rule.id === ruleId),
  );
}

function hasRuleId(rule: unknown): rule is UnderstandingRule {
  return (
    typeof rule === "object" &&
    rule !== null &&
    "id" in rule &&
    typeof rule.id === "string" &&
    rule.id !== ""
  );
}
