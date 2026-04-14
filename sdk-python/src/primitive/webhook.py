from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import re
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any, TypedDict, TypeGuard, cast

from pydantic import ValidationError

from .errors import (
    RawEmailDecodeError,
    WebhookPayloadError,
    WebhookVerificationError,
)
from .types import (
    AuthVerdict,
    EmailAuth,
    EmailReceivedEvent,
    UnknownEvent,
    ValidateEmailAuthResult,
    WebhookEvent,
)
from .validation import (
    _create_model_validation_error,
    validate_email_received_event,
)

WEBHOOK_VERSION = "2025-12-14"
PRIMITIVE_SIGNATURE_HEADER = "Primitive-Signature"
LEGACY_SIGNATURE_HEADER = "MyMX-Signature"
PRIMITIVE_CONFIRMED_HEADER = "X-Primitive-Confirmed"
LEGACY_CONFIRMED_HEADER = "X-MyMX-Confirmed"
_SIGNATURE_HEADER_NAMES = ("primitive-signature", "mymx-signature")
STANDARD_WEBHOOK_ID_HEADER = "webhook-id"
STANDARD_WEBHOOK_TIMESTAMP_HEADER = "webhook-timestamp"
STANDARD_WEBHOOK_SIGNATURE_HEADER = "webhook-signature"
_WHSEC_PREFIX = "whsec_"
_BASE64_PATTERN = re.compile(r"^[A-Za-z0-9+/]*={0,2}$")
DEFAULT_TOLERANCE_SECONDS = 5 * 60
FUTURE_TOLERANCE_SECONDS = 60
HEX_PATTERN = re.compile(r"^[0-9a-f]+$", re.IGNORECASE)
_POSITION_RE = re.compile(r"char\s+(\d+)")
_PRETTY_PRINTED_JSON_RE = re.compile(r"^\s*\{[\s\S]*\n\s{2,}")
_UNDEFINED = object()


class SignResult(TypedDict):
    header: str
    timestamp: int
    v1: str


def buffer_to_string(buffer: bytes, label: str) -> str:
    try:
        return buffer.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise WebhookPayloadError(
            "INVALID_ENCODING",
            f"{label} contains invalid UTF-8 bytes",
            f"Ensure the {label} is valid UTF-8 encoded text. If the data is binary, it should be base64 encoded first.",
            error,
        ) from error


def _field(obj: Any, *names: str) -> Any:
    for name in names:
        if isinstance(obj, Mapping) and name in obj:
            return obj[name]
        if hasattr(obj, name):
            return getattr(obj, name)
    raise KeyError(names[0])


def _missing_payload_field(
    path: str, cause: Exception | None = None
) -> WebhookPayloadError:
    return WebhookPayloadError(
        "PAYLOAD_WRONG_TYPE",
        f'Missing required field "{path}" in webhook payload',
        f'Check that "{path}" is present in the webhook payload.',
        cause,
    )


def _invalid_payload_field(
    path: str,
    message: str,
    suggestion: str,
    cause: Exception | None = None,
) -> WebhookPayloadError:
    return WebhookPayloadError("PAYLOAD_WRONG_TYPE", message, suggestion, cause)


def _require_field(obj: Any, path: str, *names: str) -> Any:
    try:
        return _field(obj, *names)
    except KeyError as error:
        raise _missing_payload_field(path, error) from error


def _unwrap_root(value: Any) -> Any:
    return getattr(value, "root", value)


def _enum_value(value: Any) -> Any:
    return getattr(value, "value", value)


def _detect_reserialized_body(body: str) -> str | None:
    if _PRETTY_PRINTED_JSON_RE.search(body):
        return (
            "Request body appears re-serialized (pretty-printed). Use the raw "
            "request body before any json.loads() or json.dumps() calls."
        )
    return None


def parse_json_body(raw_body: str | bytes | bytearray | memoryview) -> Any:
    if isinstance(raw_body, str):
        body_str = raw_body
    else:
        body_str = buffer_to_string(bytes(raw_body), "request body")

    if not body_str or body_str.strip() == "":
        raise WebhookPayloadError(
            "PAYLOAD_EMPTY_BODY",
            "Received empty request body",
            "The request body is empty. Check your web framework is correctly passing the request body.",
        )

    clean_body = body_str[1:] if body_str.startswith("\ufeff") else body_str

    try:
        return json.loads(clean_body)
    except json.JSONDecodeError as error:
        match = _POSITION_RE.search(str(error))
        position = match.group(1) if match else None
        raise WebhookPayloadError(
            "JSON_PARSE_FAILED",
            "Failed to parse webhook body as JSON",
            (
                f"Invalid JSON at position {position}. Check your web framework isn't truncating the request body."
                if position
                else f"Invalid JSON: {error.msg}. Check the raw request body is valid JSON."
            ),
            error,
        ) from error


def sign_webhook_payload(
    raw_body: str | bytes | bytearray | memoryview,
    secret: str | bytes,
    timestamp: int | None = None,
) -> SignResult:
    ts = (
        timestamp
        if timestamp is not None
        else int(datetime.now(tz=timezone.utc).timestamp())
    )
    body = (
        raw_body
        if isinstance(raw_body, str)
        else buffer_to_string(bytes(raw_body), "raw_body")
    )
    secret_bytes = secret.encode("utf-8") if isinstance(secret, str) else secret
    signed_payload = f"{ts}.{body}".encode()
    v1 = hmac.new(secret_bytes, signed_payload, hashlib.sha256).hexdigest()
    return {"header": f"t={ts},v1={v1}", "timestamp": ts, "v1": v1}


def _parse_signature_header(signature_header: str) -> tuple[int, list[str]] | None:
    if not signature_header:
        return None

    timestamp: int | None = None
    signatures: list[str] = []

    for part in signature_header.split(","):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or not value:
            continue
        if key == "t":
            try:
                timestamp = int(value)
            except ValueError:
                continue
        elif key == "v1":
            signatures.append(value)

    if timestamp is None or not signatures:
        return None
    return timestamp, signatures


def _header_value_to_string(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, (bytes, bytearray, memoryview)):
        return buffer_to_string(bytes(value), "Primitive-Signature header")
    return str(value)


def verify_webhook_signature(
    *,
    raw_body: str | bytes | bytearray | memoryview,
    signature_header: str,
    secret: str | bytes | None,
    tolerance_seconds: int = DEFAULT_TOLERANCE_SECONDS,
    now_seconds: int | None = None,
) -> bool:
    if secret in (None, "", b""):
        raise WebhookVerificationError(
            "MISSING_SECRET",
            "Webhook secret is required but was empty or not provided",
        )

    parsed = _parse_signature_header(signature_header)
    if not parsed:
        raise WebhookVerificationError(
            "INVALID_SIGNATURE_HEADER",
            "Invalid Primitive-Signature header format. Expected: t={timestamp},v1={signature}",
        )

    timestamp, signatures = parsed
    now = (
        now_seconds
        if now_seconds is not None
        else int(datetime.now(tz=timezone.utc).timestamp())
    )
    age = now - timestamp
    if age > tolerance_seconds:
        raise WebhookVerificationError(
            "TIMESTAMP_OUT_OF_RANGE",
            f"Webhook timestamp too old ({age}s). Max age is {tolerance_seconds}s.",
        )
    if age < -FUTURE_TOLERANCE_SECONDS:
        raise WebhookVerificationError(
            "TIMESTAMP_OUT_OF_RANGE",
            "Webhook timestamp is too far in the future. Check server clock sync.",
        )

    body = (
        raw_body
        if isinstance(raw_body, str)
        else buffer_to_string(bytes(raw_body), "request body")
    )
    secret_bytes = secret.encode("utf-8") if isinstance(secret, str) else secret
    signed_payload = f"{timestamp}.{body}".encode()
    expected = hmac.new(secret_bytes, signed_payload, hashlib.sha256).hexdigest()

    for provided in signatures:
        normalized = provided.lower()
        if (
            len(provided) == len(expected)
            and HEX_PATTERN.fullmatch(provided)
            and hmac.compare_digest(normalized, expected)
        ):
            return True

    reserialization_hint = _detect_reserialized_body(body)
    message = (
        f"No valid signature found. {reserialization_hint}"
        if reserialization_hint
        else "No valid signature found. Verify the webhook secret matches and you're using the raw request body (not re-serialized JSON)."
    )

    raise WebhookVerificationError(
        "SIGNATURE_MISMATCH",
        message,
    )


# ---------------------------------------------------------------------------
# Standard Webhooks
# ---------------------------------------------------------------------------


class StandardWebhooksSignResult(TypedDict):
    signature: str
    msg_id: str
    timestamp: int


def _prepare_standard_webhooks_secret(secret: str | bytes) -> bytes:
    if isinstance(secret, bytes):
        if len(secret) == 0:
            raise WebhookVerificationError(
                "MISSING_SECRET",
                "Webhook secret is required but was empty or not provided.",
            )
        return secret
    key_str = secret
    if key_str.startswith(_WHSEC_PREFIX):
        key_str = key_str[len(_WHSEC_PREFIX) :]
    if not key_str or not _BASE64_PATTERN.fullmatch(key_str):
        raise WebhookVerificationError(
            "MISSING_SECRET",
            "Standard Webhooks secret must be base64-encoded (optionally with whsec_ prefix).",
        )
    try:
        decoded = base64.b64decode(key_str)
    except (binascii.Error, ValueError) as exc:
        raise WebhookVerificationError(
            "MISSING_SECRET",
            "Standard Webhooks secret must be base64-encoded (optionally with whsec_ prefix).",
        ) from exc
    if len(decoded) == 0:
        raise WebhookVerificationError(
            "MISSING_SECRET",
            "Webhook secret is required but was empty or not provided.",
        )
    return decoded


def _parse_standard_webhooks_signatures(header: str) -> list[str]:
    if not header:
        return []
    signatures: list[str] = []
    for entry in header.split(" "):
        entry = entry.strip()
        if not entry or "," not in entry:
            continue
        version, sig = entry.split(",", 1)
        if version == "v1" and sig:
            signatures.append(sig)
    return signatures


def sign_standard_webhooks_payload(
    raw_body: str | bytes | bytearray | memoryview,
    secret: str | bytes,
    msg_id: str,
    timestamp: int | None = None,
) -> StandardWebhooksSignResult:
    ts = (
        timestamp
        if timestamp is not None
        else int(datetime.now(tz=timezone.utc).timestamp())
    )
    body = (
        raw_body
        if isinstance(raw_body, str)
        else buffer_to_string(bytes(raw_body), "raw_body")
    )
    key = _prepare_standard_webhooks_secret(secret)
    signed_payload = f"{msg_id}.{ts}.{body}".encode()
    sig = base64.b64encode(
        hmac.new(key, signed_payload, hashlib.sha256).digest()
    ).decode()
    return {"signature": f"v1,{sig}", "msg_id": msg_id, "timestamp": ts}


def verify_standard_webhooks_signature(
    *,
    raw_body: str | bytes | bytearray | memoryview,
    msg_id: str,
    timestamp: str,
    signature_header: str,
    secret: str | bytes | None,
    tolerance_seconds: int = DEFAULT_TOLERANCE_SECONDS,
    now_seconds: int | None = None,
) -> bool:
    if secret in (None, "", b""):
        raise WebhookVerificationError(
            "MISSING_SECRET",
            "Webhook secret is required but was empty or not provided.",
        )

    key = _prepare_standard_webhooks_secret(secret)  # type: ignore[arg-type]
    if len(key) == 0:
        raise WebhookVerificationError(
            "MISSING_SECRET",
            "Webhook secret is required but was empty or not provided.",
        )

    try:
        ts = int(timestamp)
    except (ValueError, TypeError) as exc:
        raise WebhookVerificationError(
            "INVALID_SIGNATURE_HEADER",
            f'Invalid webhook-timestamp header: "{timestamp}". Expected a unix timestamp in seconds.',
        ) from exc

    if ts < 0:
        raise WebhookVerificationError(
            "INVALID_SIGNATURE_HEADER",
            f'Invalid webhook-timestamp header: "{timestamp}". Expected a unix timestamp in seconds.',
        )

    now = (
        now_seconds
        if now_seconds is not None
        else int(datetime.now(tz=timezone.utc).timestamp())
    )
    age = now - ts
    if age > tolerance_seconds:
        raise WebhookVerificationError(
            "TIMESTAMP_OUT_OF_RANGE",
            f"Webhook timestamp too old ({age}s). Max age is {tolerance_seconds}s.",
        )
    if age < -FUTURE_TOLERANCE_SECONDS:
        raise WebhookVerificationError(
            "TIMESTAMP_OUT_OF_RANGE",
            "Webhook timestamp is too far in the future. Check server clock sync.",
        )

    body = (
        raw_body
        if isinstance(raw_body, str)
        else buffer_to_string(bytes(raw_body), "request body")
    )
    signed_payload = f"{msg_id}.{ts}.{body}".encode()
    expected = base64.b64encode(
        hmac.new(key, signed_payload, hashlib.sha256).digest()
    ).decode()

    signatures = _parse_standard_webhooks_signatures(signature_header)
    if not signatures:
        raise WebhookVerificationError(
            "INVALID_SIGNATURE_HEADER",
            'Invalid webhook-signature header format. Expected: "v1,<base64>".',
        )

    expected_bytes = base64.b64decode(expected)
    for sig in signatures:
        try:
            sig_bytes = base64.b64decode(sig)
        except (binascii.Error, ValueError):
            continue
        if len(sig_bytes) == len(expected_bytes) and hmac.compare_digest(
            sig_bytes, expected_bytes
        ):
            return True

    raise WebhookVerificationError(
        "SIGNATURE_MISMATCH",
        "No valid signature found. Verify the webhook secret matches and you're using the raw request body (not re-serialized JSON).",
    )


def _detect_standard_webhooks_headers(
    headers: Mapping[str, Any],
) -> tuple[str, str, str] | None:
    targets = {
        "webhook-signature": "signature",
        "webhook-id": "msg_id",
        "webhook-timestamp": "timestamp",
    }
    values: dict[str, str] = {"signature": "", "msg_id": "", "timestamp": ""}
    has_signature_key = False
    for key, value in headers.items():
        lower = key.lower()
        if lower in targets:
            field = targets[lower]
            if lower == "webhook-signature":
                has_signature_key = True
            if isinstance(value, Sequence) and not isinstance(
                value, (bytes, bytearray, str)
            ):
                values[field] = _header_value_to_string(value[0]) if value else ""
            else:
                values[field] = _header_value_to_string(value)

    if not has_signature_key:
        return None

    signature = values["signature"]
    if not signature:
        raise WebhookVerificationError(
            "INVALID_SIGNATURE_HEADER",
            'Empty webhook-signature header. Expected: "v1,<base64>".',
        )

    msg_id = values["msg_id"]
    timestamp = values["timestamp"]
    if not msg_id or not timestamp:
        missing = "webhook-id" if not msg_id else "webhook-timestamp"
        raise WebhookVerificationError(
            "INVALID_SIGNATURE_HEADER",
            f"Found webhook-signature header but missing {missing} header. "
            "Standard Webhooks requires all three headers: webhook-id, webhook-timestamp, webhook-signature.",
        )

    return msg_id, timestamp, signature


def parse_webhook_event(input: Any = _UNDEFINED) -> WebhookEvent:
    if input is _UNDEFINED:
        raise WebhookPayloadError(
            "PAYLOAD_UNDEFINED",
            "Received undefined instead of webhook payload",
            "Make sure you're passing the request body to parse_webhook_event()",
        )
    if input is None:
        raise WebhookPayloadError(
            "PAYLOAD_NULL",
            "Received null instead of webhook payload",
            "Check that your request body variable is defined.",
        )
    if isinstance(input, list):
        raise WebhookPayloadError(
            "PAYLOAD_IS_ARRAY",
            "Received array instead of webhook payload object",
            "Webhook payloads must be objects, not arrays.",
        )
    if not isinstance(input, dict):
        raise WebhookPayloadError(
            "PAYLOAD_WRONG_TYPE",
            f"Received {type(input).__name__} instead of webhook payload object",
            "Webhook payloads must be objects.",
        )
    if not isinstance(input.get("event"), str):
        raise WebhookPayloadError(
            "PAYLOAD_MISSING_EVENT",
            "Missing 'event' field in payload",
            "This doesn't look like a Primitive webhook payload.",
        )
    if input["event"] == "email.received":
        return validate_email_received_event(input)
    return cast(UnknownEvent, input)


def is_email_received_event(event: object) -> TypeGuard[EmailReceivedEvent]:
    return isinstance(event, EmailReceivedEvent)


def _get_signature_header(headers: Mapping[str, Any]) -> str:
    for name in _SIGNATURE_HEADER_NAMES:
        for key, value in headers.items():
            if key.lower() != name:
                continue
            if isinstance(value, Sequence) and not isinstance(
                value, (bytes, bytearray, str)
            ):
                first = value[0] if value else ""
                result = _header_value_to_string(first)
            else:
                result = _header_value_to_string(value)
            if result:
                return result
            break  # matched key but empty value, try next header name
    return ""


def handle_webhook(
    *,
    body: str | bytes | bytearray | memoryview,
    headers: Mapping[str, Any],
    secret: str,
    tolerance_seconds: int | None = None,
) -> EmailReceivedEvent:
    tol = (
        tolerance_seconds
        if tolerance_seconds is not None
        else DEFAULT_TOLERANCE_SECONDS
    )
    sw_headers = _detect_standard_webhooks_headers(headers)
    if sw_headers:
        msg_id, timestamp, signature = sw_headers
        verify_standard_webhooks_signature(
            raw_body=body,
            msg_id=msg_id,
            timestamp=timestamp,
            signature_header=signature,
            secret=secret,
            tolerance_seconds=tol,
        )
    else:
        verify_webhook_signature(
            raw_body=body,
            signature_header=_get_signature_header(headers),
            secret=secret,
            tolerance_seconds=tol,
        )
    parsed = parse_json_body(body)
    return validate_email_received_event(parsed)


def confirmed_headers() -> dict[str, str]:
    return {PRIMITIVE_CONFIRMED_HEADER: "true", LEGACY_CONFIRMED_HEADER: "true"}


def _parse_iso8601(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _normalize_sha256(value: str) -> str:
    return value.lower()


def is_download_expired(
    event: EmailReceivedEvent | Mapping[str, Any],
    now: int | None = None,
) -> bool:
    now_ms = (
        now
        if now is not None
        else int(datetime.now(tz=timezone.utc).timestamp() * 1000)
    )
    email = _require_field(event, "email", "email")
    content = _require_field(email, "email.content", "content")
    download = _require_field(content, "email.content.download", "download")
    expires_at = _require_field(
        download, "email.content.download.expires_at", "expires_at"
    )
    try:
        expires_ms = int(_parse_iso8601(expires_at).timestamp() * 1000)
    except (AttributeError, TypeError, ValueError) as error:
        raise _invalid_payload_field(
            "email.content.download.expires_at",
            f'Invalid value for "email.content.download.expires_at": {expires_at!r} is not a valid ISO 8601 timestamp',
            'Check that "email.content.download.expires_at" is a valid ISO 8601 timestamp.',
            error,
        ) from error
    return now_ms >= expires_ms


def get_download_time_remaining(
    event: EmailReceivedEvent | Mapping[str, Any],
    now: int | None = None,
) -> int:
    now_ms = (
        now
        if now is not None
        else int(datetime.now(tz=timezone.utc).timestamp() * 1000)
    )
    email = _require_field(event, "email", "email")
    content = _require_field(email, "email.content", "content")
    download = _require_field(content, "email.content.download", "download")
    expires_at = _require_field(
        download, "email.content.download.expires_at", "expires_at"
    )
    try:
        expires_ms = int(_parse_iso8601(expires_at).timestamp() * 1000)
    except (AttributeError, TypeError, ValueError) as error:
        raise _invalid_payload_field(
            "email.content.download.expires_at",
            f'Invalid value for "email.content.download.expires_at": {expires_at!r} is not a valid ISO 8601 timestamp',
            'Check that "email.content.download.expires_at" is a valid ISO 8601 timestamp.',
            error,
        ) from error
    return max(0, expires_ms - now_ms)


def is_raw_included(event: EmailReceivedEvent | Mapping[str, Any]) -> bool:
    email = _require_field(event, "email", "email")
    content = _require_field(email, "email.content", "content")
    raw = _unwrap_root(_require_field(content, "email.content.raw", "raw"))
    return bool(_require_field(raw, "email.content.raw.included", "included"))


def decode_raw_email(
    event: EmailReceivedEvent | Mapping[str, Any],
    *,
    verify: bool = True,
) -> bytes:
    email = _require_field(event, "email", "email")
    content = _require_field(email, "email.content", "content")
    raw = _unwrap_root(_require_field(content, "email.content.raw", "raw"))
    download = _require_field(content, "email.content.download", "download")
    if not _require_field(raw, "email.content.raw.included", "included"):
        raise RawEmailDecodeError(
            "NOT_INCLUDED",
            "Raw email not included inline "
            f"(size: {_require_field(raw, 'email.content.raw.size_bytes', 'size_bytes')} bytes, "
            f"threshold: {_require_field(raw, 'email.content.raw.max_inline_bytes', 'max_inline_bytes')} bytes). "
            f"Download from: {_require_field(download, 'email.content.download.url', 'url')}",
        )

    try:
        decoded = base64.b64decode(
            _require_field(raw, "email.content.raw.data", "data"), validate=True
        )
    except (binascii.Error, TypeError, ValueError) as error:
        raise RawEmailDecodeError(
            "INVALID_BASE64",
            "Raw email data is not valid base64. The raw email data may be malformed.",
        ) from error

    if verify:
        digest = hashlib.sha256(decoded).hexdigest()
        try:
            expected = _normalize_sha256(
                _require_field(raw, "email.content.raw.sha256", "sha256")
            )
        except (AttributeError, TypeError) as error:
            raise _invalid_payload_field(
                "email.content.raw.sha256",
                'Invalid value for "email.content.raw.sha256": expected a hex string',
                'Check that "email.content.raw.sha256" is a hex-encoded SHA-256 string.',
                error,
            ) from error
        if digest != expected:
            raise RawEmailDecodeError(
                "HASH_MISMATCH",
                f"SHA-256 hash mismatch. Expected: {expected}, got: {digest}. "
                "The raw email data may be corrupted.",
            )
    return decoded


def verify_raw_email_download(
    downloaded: bytes | bytearray | memoryview,
    event: EmailReceivedEvent | Mapping[str, Any],
) -> bytes:
    buffer = bytes(downloaded)
    digest = hashlib.sha256(buffer).hexdigest()
    email = _require_field(event, "email", "email")
    content = _require_field(email, "email.content", "content")
    raw = _unwrap_root(_require_field(content, "email.content.raw", "raw"))
    try:
        expected = _normalize_sha256(
            _require_field(raw, "email.content.raw.sha256", "sha256")
        )
    except (AttributeError, TypeError) as error:
        raise _invalid_payload_field(
            "email.content.raw.sha256",
            'Invalid value for "email.content.raw.sha256": expected a hex string',
            'Check that "email.content.raw.sha256" is a hex-encoded SHA-256 string.',
            error,
        ) from error
    if digest != expected:
        raise RawEmailDecodeError(
            "HASH_MISMATCH",
            f"SHA-256 hash mismatch. Expected: {expected}, got: {digest}. The downloaded content may be corrupted.",
        )
    return buffer


def validate_email_auth(
    auth: EmailAuth | Mapping[str, Any],
) -> ValidateEmailAuthResult:
    if isinstance(auth, Mapping):
        try:
            auth = EmailAuth.model_validate(auth, by_alias=True, by_name=True)
        except ValidationError as error:
            raise _create_model_validation_error(error) from error

    reasons: list[str] = []
    min_secure_key_bits = 1024
    dmarc = _enum_value(auth.dmarc)
    spf = _enum_value(auth.spf)
    dmarc_policy = _enum_value(auth.dmarc_policy)

    if dmarc in {"temperror", "permerror"}:
        return ValidateEmailAuthResult(
            verdict=AuthVerdict.UNKNOWN,
            confidence="low",
            reasons=[
                f"DMARC verification error ({dmarc})",
                "Cannot determine email authenticity due to DNS or policy errors",
            ],
        )

    if spf in {"temperror", "permerror"}:
        reasons.append(f"SPF verification error ({spf})")

    weak_key_signatures = [
        sig
        for sig in auth.dkim_signatures
        if sig.key_bits is not None and sig.key_bits < min_secure_key_bits
    ]
    for sig in weak_key_signatures:
        reasons.append(
            f"Weak DKIM key ({sig.key_bits} bits) for {sig.domain} - "
            f"minimum {min_secure_key_bits} bits recommended"
        )

    if dmarc == "pass":
        aligned_sigs = [
            sig
            for sig in auth.dkim_signatures
            if _enum_value(sig.result) == "pass" and sig.aligned
        ]
        if auth.dmarc_dkim_aligned and aligned_sigs:
            domains = ", ".join(sig.domain for sig in aligned_sigs)
            reasons.insert(0, f"DMARC passed with DKIM alignment ({domains})")
            return ValidateEmailAuthResult(
                verdict=AuthVerdict.LEGIT,
                confidence="medium" if weak_key_signatures else "high",
                reasons=reasons,
            )
        if auth.dmarc_spf_aligned and spf == "pass":
            reasons.insert(0, "DMARC passed with SPF alignment")
            reasons.append(
                "No aligned DKIM signature (SPF can break through forwarding)"
            )
            return ValidateEmailAuthResult(
                verdict=AuthVerdict.LEGIT,
                confidence="medium",
                reasons=reasons,
            )
        reasons.insert(0, "DMARC passed")
        return ValidateEmailAuthResult(
            verdict=AuthVerdict.LEGIT,
            confidence="medium",
            reasons=reasons,
        )

    if dmarc == "fail":
        if dmarc_policy == "reject":
            reasons.insert(0, "DMARC failed and domain has reject policy")
            reasons.append(
                "The sender's domain explicitly rejects emails that fail authentication"
            )
            return ValidateEmailAuthResult(AuthVerdict.SUSPICIOUS, "high", reasons)
        if dmarc_policy == "quarantine":
            reasons.insert(0, "DMARC failed and domain has quarantine policy")
            reasons.append("The sender's domain marks failing emails as suspicious")
            return ValidateEmailAuthResult(AuthVerdict.SUSPICIOUS, "high", reasons)
        reasons.insert(0, "DMARC failed (domain is in monitoring mode)")
        if spf == "fail":
            reasons.append("SPF failed - sending IP not authorized")
            return ValidateEmailAuthResult(AuthVerdict.SUSPICIOUS, "medium", reasons)
        return ValidateEmailAuthResult(AuthVerdict.SUSPICIOUS, "low", reasons)

    if dmarc == "none":
        if spf == "fail":
            reasons.extend(
                [
                    "No DMARC record for sender domain",
                    "SPF failed - sending IP not authorized",
                ]
            )
            return ValidateEmailAuthResult(AuthVerdict.SUSPICIOUS, "medium", reasons)
        passing_dkim = [
            sig for sig in auth.dkim_signatures if _enum_value(sig.result) == "pass"
        ]
        if passing_dkim:
            reasons.append("No DMARC record for sender domain")
            reasons.append(
                f"DKIM verified for: {', '.join(sig.domain for sig in passing_dkim)}"
            )
            if spf == "pass":
                reasons.append("SPF passed")
            return ValidateEmailAuthResult(AuthVerdict.UNKNOWN, "low", reasons)
        if spf == "pass":
            reasons.extend(
                [
                    "No DMARC record for sender domain",
                    "No DKIM signatures present",
                    "SPF passed (but SPF alone is weak authentication)",
                ]
            )
            return ValidateEmailAuthResult(AuthVerdict.UNKNOWN, "low", reasons)
        reasons.extend(
            ["No DMARC record for sender domain", "No valid authentication found"]
        )
        return ValidateEmailAuthResult(AuthVerdict.UNKNOWN, "low", reasons)

    return ValidateEmailAuthResult(
        verdict=AuthVerdict.UNKNOWN,
        confidence="low",
        reasons=["Unable to determine email authenticity"],
    )
