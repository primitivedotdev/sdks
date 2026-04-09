from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Generic, Literal, TypeVar

from jsonschema import Draft7Validator, FormatChecker

from primitive_sdk.errors import ValidationIssue, WebhookValidationError
from primitive_sdk.schema import email_received_event_json_schema
from primitive_sdk.types import EmailReceivedEvent

T = TypeVar("T")

_validator = Draft7Validator(email_received_event_json_schema, format_checker=FormatChecker())
_REQUIRED_PROPERTY_RE = re.compile(r"'([^']+)' is a required property")


@dataclass(slots=True)
class ValidationSuccess(Generic[T]):
    success: Literal[True]
    data: T


@dataclass(slots=True)
class ValidationFailure:
    success: Literal[False]
    error: WebhookValidationError


ValidationResult = ValidationSuccess[T] | ValidationFailure


def _to_field_path(path: list[str | int]) -> str:
    if not path:
        return "payload"
    return ".".join(str(segment) for segment in path)


def _validation_sort_key(error: Any) -> tuple[str, ...]:
    return tuple(str(segment) for segment in error.absolute_path)


def _format_validation_issue(error: Any) -> tuple[str, str, str]:
    field = _to_field_path(list(error.absolute_path))
    validator = error.validator

    if validator == "required":
        match = _REQUIRED_PROPERTY_RE.search(str(error.message))
        missing = match.group(1) if match else "unknown"
        message = f"Missing required field: {missing}"
        suggestion = f'Add the required field "{missing}" to the webhook payload.'
        if field != "payload":
            field = f"{field}.{missing}"
        else:
            field = missing
        return field, message, suggestion

    if validator == "const":
        return (
            field,
            f"Invalid value for {field}: {error.message}",
            f'Check the value of "{field}" in the webhook payload.',
        )

    if validator == "type":
        return (
            field,
            f"Invalid type for {field}: {error.message}",
            f'Check the value of "{field}" in the webhook payload.',
        )

    return (
        field,
        f"Validation failed for {field}: {error.message}",
        f'Check the value of "{field}" in the webhook payload.',
    )


def _create_validation_error(errors: list[Any]) -> WebhookValidationError:
    issues = [
        ValidationIssue(
            path=_to_field_path(list(error.absolute_path)),
            message=str(error.message),
            validator=str(error.validator),
        )
        for error in errors
    ]

    if not errors:
        return WebhookValidationError(
            "payload",
            "Webhook payload failed schema validation",
            'Check the structure of the webhook payload against "email_received_event_json_schema".',
            issues,
        )

    field, message, suggestion = _format_validation_issue(errors[0])
    return WebhookValidationError(field, message, suggestion, issues)


def validate_email_received_event(input: Any) -> EmailReceivedEvent:
    errors = sorted(_validator.iter_errors(input), key=_validation_sort_key)
    if errors:
        raise _create_validation_error(errors)
    return EmailReceivedEvent.model_validate(input)


def safe_validate_email_received_event(input: Any) -> ValidationResult[EmailReceivedEvent]:
    try:
        return ValidationSuccess(success=True, data=validate_email_received_event(input))
    except WebhookValidationError as error:
        return ValidationFailure(success=False, error=error)
