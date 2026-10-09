"""Typed ``sent_email.*`` webhook events: what happened to mail you sent.

These events are a separate payload family from the inbound ``email.*``
events, with their own ``version``. An endpoint receives them only if its
``rules.event_types`` lists them by name. The body is validated against the
canonical ``sent-email-event`` JSON schema; the models are generated from it.
"""

from __future__ import annotations

from typing import Any, TypeAlias, TypeGuard

from jsonschema import Draft7Validator, FormatChecker
from pydantic import ValidationError

from .errors import WebhookValidationError
from .events import SENT_EMAIL_EVENT_TYPES
from .schema import sent_email_event_json_schema
from .sent_email_models_generated import (
    SentEmailAcceptedEvent,
    SentEmailCompletedEvent,
    SentEmailCompletedSummary,
    SentEmailEventDelivery,
    SentEmailFailedByKind,
    SentEmailFailureKind,
    SentEmailLegacyMessageResultEvent,
    SentEmailOutcome,
    SentEmailRecipient,
    SentEmailRecipientResultEvent,
    SentEmailRecipientType,
    SentEmailRecord,
    SentEmailRelay,
    SentEmailRolledUpFailure,
    SentEmailRollupOutcome,
    SentEmailRollupResultEvent,
    SentEmailTag,
)
from .sent_email_models_generated import (
    SentEmailEvent as SentEmailEventModel,
)
from .validation import (
    ValidationFailure,
    ValidationResult,
    ValidationSuccess,
    _create_model_validation_error,
    _create_validation_error,
    _validation_sort_key,
)

_SENT_EMAIL_EVENT_TYPE_SET = frozenset(SENT_EMAIL_EVENT_TYPES)

#: Any ``sent_email.delivered`` or ``sent_email.failed`` event.
SentEmailResultEvent: TypeAlias = (
    SentEmailRecipientResultEvent
    | SentEmailRollupResultEvent
    | SentEmailLegacyMessageResultEvent
)

#: Any ``sent_email.*`` event, as the parser returns it.
SentEmailEvent: TypeAlias = (
    SentEmailAcceptedEvent | SentEmailResultEvent | SentEmailCompletedEvent
)

_SCHEMA_NAME = "sent_email_event_json_schema"


def _definition_validator(definition: str | None) -> Draft7Validator:
    schema: dict[str, Any] = dict(sent_email_event_json_schema)
    if definition is not None:
        schema["$ref"] = f"#/definitions/{definition}"
    return Draft7Validator(schema, format_checker=FormatChecker())


_ANY_VALIDATOR = _definition_validator(None)
_ACCEPTED_VALIDATOR = _definition_validator("SentEmailAcceptedEvent")
_RECIPIENT_RESULT_VALIDATOR = _definition_validator("SentEmailRecipientResultEvent")
_ROLLUP_RESULT_VALIDATOR = _definition_validator("SentEmailRollupResultEvent")
_LEGACY_RESULT_VALIDATOR = _definition_validator("SentEmailLegacyMessageResultEvent")
_COMPLETED_VALIDATOR = _definition_validator("SentEmailCompletedEvent")


def is_sent_email_event_type(event_type: str | None) -> bool:
    """Return True if ``event_type`` is one of the four ``sent_email.*`` events."""
    return event_type is not None and event_type in _SENT_EMAIL_EVENT_TYPE_SET


def _select_validator(input: Any) -> Draft7Validator:
    """Pick the event shape a body claims to be, from its ``event``, ``scope``
    and ``reason``, so a malformed body is reported against that shape."""
    if not isinstance(input, dict):
        return _ANY_VALIDATOR
    event = input.get("event")
    if event == "sent_email.accepted":
        return _ACCEPTED_VALIDATOR
    if event == "sent_email.completed":
        return _COMPLETED_VALIDATOR
    if event in ("sent_email.delivered", "sent_email.failed"):
        if input.get("scope") == "message":
            if input.get("reason") == "legacy_message_result":
                return _LEGACY_RESULT_VALIDATOR
            return _ROLLUP_RESULT_VALIDATOR
        return _RECIPIENT_RESULT_VALIDATOR
    return _ANY_VALIDATOR


def validate_sent_email_event(input: Any) -> SentEmailEvent:
    """Validate a parsed ``sent_email.*`` webhook body against the canonical
    schema and return the typed model for its event shape.

    Raises:
        WebhookValidationError: if the body is not a valid sent_email event.
    """
    validator = _select_validator(input)
    errors = sorted(validator.iter_errors(input), key=_validation_sort_key)
    if errors:
        raise _create_validation_error(errors, _SCHEMA_NAME)
    try:
        return SentEmailEventModel.model_validate(input).root
    except ValidationError as error:
        raise _create_model_validation_error(error, "SentEmailEvent") from error


def safe_validate_sent_email_event(input: Any) -> ValidationResult[SentEmailEvent]:
    """Like :func:`validate_sent_email_event`, but returns a result instead of
    raising."""
    try:
        return ValidationSuccess(success=True, data=validate_sent_email_event(input))
    except WebhookValidationError as error:
        return ValidationFailure(success=False, error=error)


_SENT_EMAIL_MODELS = (
    SentEmailAcceptedEvent,
    SentEmailRecipientResultEvent,
    SentEmailRollupResultEvent,
    SentEmailLegacyMessageResultEvent,
    SentEmailCompletedEvent,
)


def _event_name(event: object) -> str | None:
    if isinstance(event, dict):
        value = event.get("event")
    else:
        value = getattr(event, "event", None)
    return str(value) if isinstance(value, str) else None


def is_sent_email_event(event: object) -> TypeGuard[SentEmailEvent]:
    """Type guard for any ``sent_email.*`` event, as returned by the parser."""
    return isinstance(event, _SENT_EMAIL_MODELS)


def is_sent_email_accepted_event(
    event: object,
) -> TypeGuard[SentEmailAcceptedEvent]:
    """Type guard for the ``sent_email.accepted`` event."""
    return isinstance(event, SentEmailAcceptedEvent)


def is_sent_email_delivered_event(
    event: object,
) -> TypeGuard[SentEmailResultEvent]:
    """Type guard for any ``sent_email.delivered`` event."""
    return is_sent_email_event(event) and _event_name(event) == "sent_email.delivered"


def is_sent_email_failed_event(event: object) -> TypeGuard[SentEmailResultEvent]:
    """Type guard for any ``sent_email.failed`` event."""
    return is_sent_email_event(event) and _event_name(event) == "sent_email.failed"


def is_sent_email_completed_event(
    event: object,
) -> TypeGuard[SentEmailCompletedEvent]:
    """Type guard for the ``sent_email.completed`` event."""
    return isinstance(event, SentEmailCompletedEvent)


def is_sent_email_recipient_result_event(
    event: object,
) -> TypeGuard[SentEmailRecipientResultEvent]:
    """Type guard for a ``sent_email.delivered`` or ``sent_email.failed`` event
    about one recipient (``scope == "recipient"``)."""
    return isinstance(event, SentEmailRecipientResultEvent)


__all__ = [
    "SENT_EMAIL_EVENT_TYPES",
    "SentEmailAcceptedEvent",
    "SentEmailCompletedEvent",
    "SentEmailCompletedSummary",
    "SentEmailEvent",
    "SentEmailEventDelivery",
    "SentEmailFailedByKind",
    "SentEmailFailureKind",
    "SentEmailLegacyMessageResultEvent",
    "SentEmailOutcome",
    "SentEmailRecipient",
    "SentEmailRecipientResultEvent",
    "SentEmailRecipientType",
    "SentEmailRecord",
    "SentEmailRelay",
    "SentEmailResultEvent",
    "SentEmailRolledUpFailure",
    "SentEmailRollupOutcome",
    "SentEmailRollupResultEvent",
    "SentEmailTag",
    "is_sent_email_accepted_event",
    "is_sent_email_completed_event",
    "is_sent_email_delivered_event",
    "is_sent_email_event",
    "is_sent_email_event_type",
    "is_sent_email_failed_event",
    "is_sent_email_recipient_result_event",
    "safe_validate_sent_email_event",
    "validate_sent_email_event",
]
