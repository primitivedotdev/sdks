from __future__ import annotations

from typing import Any

import pytest

from primitive_sdk import (
    ValidationFailure,
    WebhookValidationError,
    safe_validate_email_received_event,
    validate_email_received_event,
)
from primitive_sdk.validation import _create_validation_error, _format_validation_issue


class StubValidationError:
    def __init__(self, validator: str, message: str, absolute_path: list[str | int]) -> None:
        self.validator = validator
        self.message = message
        self.absolute_path = absolute_path


def test_validate_email_received_event_accepts_valid_payload(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(valid_payload)
    assert event.id == "evt_abc123"


def test_validate_email_received_event_rejects_invalid_payload() -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event({})


def test_safe_validate_email_received_event_returns_failure_shape() -> None:
    result = safe_validate_email_received_event({"event": "email.received"})
    assert isinstance(result, ValidationFailure)
    assert result.error.code == "SCHEMA_VALIDATION_FAILED"


def test_validate_email_received_event_accepts_date_formatted_version(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event({**valid_payload, "version": "2030-12-31"})
    assert event.version.root == "2030-12-31"


def test_validate_email_received_event_accepts_extra_unknown_fields(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(
        {
            **valid_payload,
            "extra_field": "ok",
            "delivery": {**valid_payload["delivery"], "extra_delivery": True},
            "email": {
                **valid_payload["email"],
                "auth": {**valid_payload["email"]["auth"], "extra_auth": "ok"},
            },
        }
    )
    assert event.id == "evt_abc123"


def test_validate_email_received_event_rejects_javascript_download_url(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "content": {
                        **valid_payload["email"]["content"],
                        "download": {
                            **valid_payload["email"]["content"]["download"],
                            "url": "javascript:alert(1)",
                        },
                    },
                },
            }
        )


def test_validate_email_received_event_rejects_http_attachments_download_url(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "parsed": {
                        **valid_payload["email"]["parsed"],
                        "attachments_download_url": "http://example.com/attachments",
                    },
                },
            }
        )


def test_validate_email_received_event_accepts_https_attachments_download_url(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(
        {
            **valid_payload,
            "email": {
                **valid_payload["email"],
                "parsed": {
                    **valid_payload["email"]["parsed"],
                    "attachments_download_url": (
                        "https://api.primitive.dev/v1/downloads/attachments/token456"
                    ),
                },
            },
        }
    )
    assert event.id == "evt_abc123"


def test_validate_email_received_event_rejects_fractional_dkim_key_bits(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "auth": {
                        **valid_payload["email"]["auth"],
                        "dkimSignatures": [
                            {
                                **valid_payload["email"]["auth"]["dkimSignatures"][0],
                                "keyBits": 1024.5,
                            }
                        ],
                    },
                },
            }
        )


def test_validate_email_received_event_rejects_oversized_dkim_key_bits(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "auth": {
                        **valid_payload["email"]["auth"],
                        "dkimSignatures": [
                            {
                                **valid_payload["email"]["auth"]["dkimSignatures"][0],
                                "keyBits": 20000,
                            }
                        ],
                    },
                },
            }
        )


def test_validate_email_received_event_rejects_negative_forward_attachment_counters(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "analysis": {
                        "forward": {
                            "detected": False,
                            "results": [],
                            "attachments_found": -1,
                            "attachments_analyzed": 0,
                            "attachments_limit": None,
                        }
                    },
                },
            }
        )


def test_validate_email_received_event_rejects_zero_forward_attachments_limit(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "analysis": {
                        "forward": {
                            "detected": False,
                            "results": [],
                            "attachments_found": 0,
                            "attachments_analyzed": 0,
                            "attachments_limit": 0,
                        }
                    },
                },
            }
        )


def test_validate_email_received_event_accepts_valid_forward_attachment_counters(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(
        {
            **valid_payload,
            "email": {
                **valid_payload["email"],
                "analysis": {
                    "forward": {
                        "detected": True,
                        "results": [],
                        "attachments_found": 2,
                        "attachments_analyzed": 1,
                        "attachments_limit": 10,
                    }
                },
            },
        }
    )
    assert event.id == "evt_abc123"


def test_format_validation_issue_formats_const_errors() -> None:
    field, message, suggestion = _format_validation_issue(
        StubValidationError("const", "must be equal to constant", ["event"])
    )
    assert field == "event"
    assert message == "Invalid value for event: must be equal to constant"
    assert suggestion == 'Check the value of "event" in the webhook payload.'


def test_create_validation_error_falls_back_when_no_errors_are_present() -> None:
    error = _create_validation_error([])
    assert error.field == "payload"
    assert error.args[0] == "Webhook payload failed schema validation"
    assert error.additional_error_count == 0


def test_format_validation_issue_appends_required_field_to_nested_path() -> None:
    field, message, suggestion = _format_validation_issue(
        StubValidationError("required", "'id' is a required property", ["email"])
    )
    assert field == "email.id"
    assert message == "Missing required field: id"
    assert suggestion == 'Add the required field "id" to the webhook payload.'


def test_webhook_validation_error_serializes_additional_error_count() -> None:
    error = WebhookValidationError(
        "payload",
        "bad payload",
        "fix it",
        [],
    )
    assert error.to_json() == {
        "name": "WebhookValidationError",
        "code": "SCHEMA_VALIDATION_FAILED",
        "field": "payload",
        "message": "bad payload",
        "suggestion": "fix it",
        "additionalErrorCount": 0,
    }
