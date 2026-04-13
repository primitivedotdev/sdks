from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Generic, Literal, TypeVar

from jsonschema import Draft7Validator, FormatChecker
from pydantic import ValidationError

from .errors import ValidationIssue, WebhookValidationError
from .schema import email_received_event_json_schema
from .types import EmailReceivedEvent

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


def _missing_required_property(error: Any) -> str:
    match = _REQUIRED_PROPERTY_RE.search(str(error.message))
    return match.group(1) if match else "unknown"


def _validation_issue_field(error: Any) -> str:
    field = _to_field_path(list(error.absolute_path))
    if error.validator != "required":
        return field

    missing = _missing_required_property(error)
    if field != "payload":
        return f"{field}.{missing}"
    return missing


def _format_validation_issue(error: Any) -> tuple[str, str, str]:
    field = _validation_issue_field(error)
    validator = error.validator

    if validator == "required":
        missing = _missing_required_property(error)
        message = f"Missing required field: {missing}"
        suggestion = f'Add the required field "{missing}" to the webhook payload.'
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
            path=_validation_issue_field(error),
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


def _create_model_validation_error(error: ValidationError) -> WebhookValidationError:
    issues = [
        ValidationIssue(
            path=_to_field_path(list(issue["loc"])),
            message=str(issue["msg"]),
            validator=str(issue["type"]),
        )
        for issue in error.errors()
    ]

    if not issues:
        return WebhookValidationError(
            "payload",
            "Webhook payload failed model validation",
            'Check the structure of the webhook payload against "EmailReceivedEvent".',
            issues,
        )

    field = issues[0].path
    return WebhookValidationError(
        field,
        f"Validation failed for {field}: {issues[0].message}",
        f'Check the value of "{field}" in the webhook payload.',
        issues,
    )


def validate_email_received_event(input: Any) -> EmailReceivedEvent:
    errors = sorted(_validator.iter_errors(input), key=_validation_sort_key)
    if errors:
        raise _create_validation_error(errors)
    try:
        return EmailReceivedEvent.model_validate(input)
    except ValidationError as error:
        raise _create_model_validation_error(error) from error


def safe_validate_email_received_event(input: Any) -> ValidationResult[EmailReceivedEvent]:
    try:
        return ValidationSuccess(success=True, data=validate_email_received_event(input))
    except WebhookValidationError as error:
        return ValidationFailure(success=False, error=error)
