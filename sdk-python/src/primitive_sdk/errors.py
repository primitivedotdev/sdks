from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

VERIFICATION_ERRORS = {
    "INVALID_SIGNATURE_HEADER": {
        "message": "Missing or malformed Primitive-Signature header",
        "suggestion": "Check that you're reading the correct header (Primitive-Signature) and it's being passed correctly from your web framework.",
    },
    "TIMESTAMP_OUT_OF_RANGE": {
        "message": "Timestamp is too old (possible replay attack)",
        "suggestion": "This could indicate a replay attack, network delay, or server clock drift. Check your server's time is synced.",
    },
    "SIGNATURE_MISMATCH": {
        "message": "Signature doesn't match expected value",
        "suggestion": "Verify the webhook secret matches and you're using the raw request body (not re-serialized JSON).",
    },
    "MISSING_SECRET": {
        "message": "No webhook secret was provided",
        "suggestion": "Pass your webhook secret from the Primitive dashboard. Check that the environment variable is set.",
    },
}

PAYLOAD_ERRORS = {
    "PAYLOAD_NULL": {
        "message": "Webhook payload is null",
        "suggestion": "Ensure you're passing the parsed JSON body, not null. Check your framework's body parsing middleware.",
    },
    "PAYLOAD_UNDEFINED": {
        "message": "Webhook payload is undefined",
        "suggestion": "The payload was not provided. Make sure you're passing the request body to the handler.",
    },
    "PAYLOAD_WRONG_TYPE": {
        "message": "Webhook payload must be an object",
        "suggestion": "The payload should be a parsed JSON object. Check that you're not passing a string or other primitive.",
    },
    "PAYLOAD_IS_ARRAY": {
        "message": "Webhook payload is an array, expected object",
        "suggestion": "Primitive webhooks are single event objects, not arrays. Check the payload structure.",
    },
    "PAYLOAD_MISSING_EVENT": {
        "message": "Webhook payload missing 'event' field",
        "suggestion": "All webhook payloads must have an 'event' field. This may not be a valid Primitive webhook.",
    },
    "PAYLOAD_UNKNOWN_EVENT": {
        "message": "Unknown webhook event type",
        "suggestion": "This event type is not recognized. You may need to update your SDK or handle unknown events gracefully.",
    },
    "PAYLOAD_EMPTY_BODY": {
        "message": "Request body is empty",
        "suggestion": "The request body was empty. Ensure the webhook is sending data and your framework is parsing it correctly.",
    },
    "JSON_PARSE_FAILED": {
        "message": "Failed to parse JSON body",
        "suggestion": "The request body is not valid JSON. Check the raw body content and Content-Type header.",
    },
    "INVALID_ENCODING": {
        "message": "Invalid body encoding",
        "suggestion": "The request body encoding is not supported. Primitive webhooks use UTF-8 encoded JSON.",
    },
}

RAW_EMAIL_ERRORS = {
    "NOT_INCLUDED": {
        "message": "Raw email content not included inline",
        "suggestion": "Use the download URL at event.email.content.download.url to fetch the raw email.",
    },
    "INVALID_BASE64": {
        "message": "Raw email content is not valid base64",
        "suggestion": "The raw email data is malformed. Fetch the raw email from the download URL or regenerate the webhook payload.",
    },
    "HASH_MISMATCH": {
        "message": "SHA-256 hash verification failed",
        "suggestion": "The raw email data may be corrupted. Try downloading from the URL instead.",
    },
}

WebhookVerificationErrorCode = Literal[
    "INVALID_SIGNATURE_HEADER",
    "TIMESTAMP_OUT_OF_RANGE",
    "SIGNATURE_MISMATCH",
    "MISSING_SECRET",
]
WebhookPayloadErrorCode = Literal[
    "PAYLOAD_NULL",
    "PAYLOAD_UNDEFINED",
    "PAYLOAD_WRONG_TYPE",
    "PAYLOAD_IS_ARRAY",
    "PAYLOAD_MISSING_EVENT",
    "PAYLOAD_UNKNOWN_EVENT",
    "PAYLOAD_EMPTY_BODY",
    "JSON_PARSE_FAILED",
    "INVALID_ENCODING",
]
WebhookValidationErrorCode = Literal["SCHEMA_VALIDATION_FAILED"]
RawEmailDecodeErrorCode = Literal["NOT_INCLUDED", "INVALID_BASE64", "HASH_MISMATCH"]
WebhookErrorCode = (
    WebhookVerificationErrorCode
    | WebhookPayloadErrorCode
    | WebhookValidationErrorCode
    | RawEmailDecodeErrorCode
)


class PrimitiveWebhookError(Exception):
    code: str
    suggestion: str

    def __str__(self) -> str:
        return (
            f"{self.__class__.__name__} [{self.code}]: {self.args[0]}\n\n"
            f"Suggestion: {self.suggestion}"
        )

    def to_json(self) -> dict[str, Any]:
        return {
            "name": self.__class__.__name__,
            "code": self.code,
            "message": self.args[0],
            "suggestion": self.suggestion,
        }


class WebhookVerificationError(PrimitiveWebhookError):
    def __init__(
        self,
        code: WebhookVerificationErrorCode,
        message: str | None = None,
        suggestion: str | None = None,
    ) -> None:
        definition = VERIFICATION_ERRORS[code]
        super().__init__(message or definition["message"])
        self.code = code
        self.suggestion = suggestion or definition["suggestion"]


class WebhookPayloadError(PrimitiveWebhookError):
    def __init__(
        self,
        code: WebhookPayloadErrorCode,
        message: str | None = None,
        suggestion: str | None = None,
        cause: Exception | None = None,
    ) -> None:
        definition = PAYLOAD_ERRORS[code]
        super().__init__(message or definition["message"])
        self.code = code
        self.suggestion = suggestion or definition["suggestion"]
        self.__cause__ = cause


@dataclass(slots=True)
class ValidationIssue:
    path: str
    message: str
    validator: str


class WebhookValidationError(PrimitiveWebhookError):
    def __init__(
        self,
        field: str,
        message: str,
        suggestion: str,
        validation_errors: list[ValidationIssue],
    ) -> None:
        super().__init__(message)
        self.code = "SCHEMA_VALIDATION_FAILED"
        self.field = field
        self.suggestion = suggestion
        self.validation_errors = validation_errors
        self.additional_error_count = max(0, len(validation_errors) - 1)

    def to_json(self) -> dict[str, Any]:
        return {
            "name": self.__class__.__name__,
            "code": self.code,
            "field": self.field,
            "message": self.args[0],
            "suggestion": self.suggestion,
            "additionalErrorCount": self.additional_error_count,
        }


class RawEmailDecodeError(PrimitiveWebhookError):
    def __init__(self, code: RawEmailDecodeErrorCode, message: str | None = None) -> None:
        definition = RAW_EMAIL_ERRORS[code]
        super().__init__(message or definition["message"])
        self.code = code
        self.suggestion = definition["suggestion"]
