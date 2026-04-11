from __future__ import annotations

from typing import Any

import pytest
from pydantic import BaseModel, ValidationError

from primitive_sdk import (
    EmailReceivedEvent,
    ValidationFailure,
    WebhookValidationError,
    safe_validate_email_received_event,
    validate_email_received_event,
)
from primitive_sdk.validation import (
    _create_validation_error,
    _format_validation_issue,
    _validation_sort_key,
)


class StubValidationError:
    def __init__(self, validator: str, message: str, absolute_path: list[str | int]) -> None:
        self.validator = validator
        self.message = message
        self.absolute_path = absolute_path


def test_validate_email_received_event_accepts_valid_payload(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(valid_payload)
    assert event.id == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"


def test_validate_email_received_event_rejects_invalid_payload() -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event({})


def test_safe_validate_email_received_event_returns_failure_shape() -> None:
    result = safe_validate_email_received_event({"event": "email.received"})
    assert isinstance(result, ValidationFailure)
    assert result.error.code == "SCHEMA_VALIDATION_FAILED"


def test_safe_validate_email_received_event_wraps_model_validation_failures(
    monkeypatch: pytest.MonkeyPatch,
    valid_payload: dict[str, Any],
) -> None:
    class StubModel(BaseModel):
        field: int

    try:
        StubModel.model_validate({"field": "not-an-int"})
    except ValidationError as error:
        model_error = error
    else:
        pytest.fail("expected stub model validation to fail")

    def raise_validation_error(cls: type[EmailReceivedEvent], _: Any) -> EmailReceivedEvent:
        raise model_error

    monkeypatch.setattr(
        EmailReceivedEvent,
        "model_validate",
        classmethod(raise_validation_error),
    )

    result = safe_validate_email_received_event(valid_payload)
    assert isinstance(result, ValidationFailure)
    assert result.error.code == "SCHEMA_VALIDATION_FAILED"
    assert result.error.field == "field"


def test_validate_email_received_event_accepts_date_formatted_version(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event({**valid_payload, "version": "2030-12-31"})
    assert event.version.root == "2030-12-31"


def test_validate_email_received_event_rejects_invalid_received_at_format(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError) as error:
        validate_email_received_event(
            {
                **valid_payload,
                "email": {**valid_payload["email"], "received_at": "Tuesday"},
            }
        )

    assert error.value.field == "email.received_at"


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
    assert event.id == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"


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
    assert event.id == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"


def test_email_received_event_model_rejects_http_download_url(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(ValidationError):
        EmailReceivedEvent.model_validate(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "content": {
                        **valid_payload["email"]["content"],
                        "download": {
                            **valid_payload["email"]["content"]["download"],
                            "url": "http://example.com/raw",
                        },
                    },
                },
            }
        )


def test_email_received_event_model_rejects_http_attachments_download_url(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(ValidationError):
        EmailReceivedEvent.model_validate(
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


def test_email_received_event_model_rejects_null_alignment_flags(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(ValidationError):
        EmailReceivedEvent.model_validate(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "auth": {
                        **valid_payload["email"]["auth"],
                        "dmarcSpfAligned": None,
                        "dmarcDkimAligned": None,
                    },
                },
            }
        )


def test_email_received_event_model_rejects_null_analysis_objects(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(ValidationError):
        EmailReceivedEvent.model_validate(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "analysis": {
                        "spamassassin": None,
                        "forward": None,
                    },
                },
            }
        )


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
    assert event.id == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"


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


@pytest.mark.parametrize(
    ("absolute_path", "message", "expected_path"),
    [
        ([], "'event' is a required property", "event"),
        (["email"], "'id' is a required property", "email.id"),
    ],
)
def test_create_validation_error_uses_adjusted_required_issue_paths(
    absolute_path: list[str | int],
    message: str,
    expected_path: str,
) -> None:
    error = _create_validation_error(
        [StubValidationError("required", message, absolute_path)]
    )

    assert error.field == expected_path
    assert error.validation_errors[0].path == expected_path


def test_validation_sort_key_handles_mixed_string_and_index_segments() -> None:
    errors = [
        StubValidationError("type", "bad type", ["email", "parsed", "cc", 0]),
        StubValidationError("type", "bad type", ["email", "parsed", "bcc"]),
    ]
    sorted_errors = sorted(errors, key=_validation_sort_key)
    assert [list(error.absolute_path) for error in sorted_errors] == [
        ["email", "parsed", "bcc"],
        ["email", "parsed", "cc", 0],
    ]


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
