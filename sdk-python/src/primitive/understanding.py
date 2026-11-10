from __future__ import annotations

from .received_email import ReceivedEmail
from .types import EmailReceivedEvent, UnderstandingRule


def matched_rules(
    email: EmailReceivedEvent | ReceivedEmail, rule_id: str | None = None
) -> list[UnderstandingRule]:
    """Return the rules that matched an email and granted its delivery.

    Reads ``email.analysis.understanding.rules`` from the event
    ``handle_webhook`` returns or the ``ReceivedEmail`` that ``receive`` and
    ``normalize_received_email`` return. Returns an empty list when the
    delivery was not granted by a rule or the email carries no understanding.
    Entries without a rule id are skipped. Pass ``rule_id`` to keep only the
    entries for that rule.

    Example::

        email = primitive.receive(body=body, headers=headers, secret=secret)
        for rule in matched_rules(email):
            print(rule.id, rule.name, rule.explanation)
        is_applicant = bool(matched_rules(email, applicants_rule_id))
    """
    analysis = (
        email.analysis if isinstance(email, ReceivedEmail) else email.email.analysis
    )
    understanding = analysis.understanding
    if understanding is None or not understanding.rules:
        return []
    return [
        rule
        for rule in understanding.rules
        if rule.id and (rule_id is None or rule.id == rule_id)
    ]
