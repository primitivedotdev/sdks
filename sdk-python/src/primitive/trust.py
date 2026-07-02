"""Domain-anchored sender trust.

``validate_email_auth`` answers "was this email authenticated?" but not
"authenticated AS WHOM?". A fully authenticated email from any domain
returns a ``legit`` verdict, so a verdict check alone cannot gate actions
on "this really came from our domain". ``is_trusted_sender`` closes that
gap by anchoring the verdict to an expected From domain (and optionally
an exact sender address).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from email.utils import getaddresses
from typing import Any, Literal

from pydantic import ValidationError

from .received_email import _HEADER_ADDR_RE, _MAX_HEADER_BYTES
from .types import (
    AuthVerdict,
    EmailAuth,
    EmailReceivedEvent,
    ValidateEmailAuthResult,
)
from .webhook import _enum_value, validate_email_auth

TrustReason = Literal[
    "trusted",
    "auth-missing",
    "auth-suspicious",
    "dmarc-temperror",
    "auth-unknown",
    "dmarc-domain-mismatch",
    "from-header-multiple-addresses",
    "from-header-invalid",
    "from-domain-mismatch",
    "sender-mismatch",
]


@dataclass(slots=True)
class TrustedSenderResult:
    """Trust decision for an inbound email.

    ``retryable`` is True only for transient failures (``dmarc-temperror``):
    respond with a 5xx so webhook redelivery retries after DNS recovers.
    Every other untrusted reason is permanent for this email. ``auth`` is
    the underlying ``validate_email_auth`` result, for logging.
    """

    trusted: bool
    retryable: bool
    reason: TrustReason
    auth: ValidateEmailAuthResult


def _missing_auth_result() -> ValidateEmailAuthResult:
    return ValidateEmailAuthResult(
        verdict=AuthVerdict.UNKNOWN,
        confidence="low",
        reasons=["Missing or malformed email.auth on event"],
    )


def _untrusted(
    reason: TrustReason,
    auth: ValidateEmailAuthResult,
    *,
    retryable: bool = False,
) -> TrustedSenderResult:
    return TrustedSenderResult(
        trusted=False, retryable=retryable, reason=reason, auth=auth
    )


def _parse_from_strict(value: str | None) -> tuple[str | None, str]:
    """Strict single-address From parse for the trust gate.

    Unlike ``parse_header_address`` (which is lenient and lets the
    normalizer fall back to the attacker-controlled SMTP envelope
    sender), this rejects multi-address headers and anything that fails
    address validation. Returns ``(address, "")`` or ``(None, reason)``
    where reason is ``"multiple"`` or ``"invalid"``.
    """
    if value is None:
        return None, "invalid"
    trimmed = value.strip()
    if not trimmed:
        return None, "invalid"
    if len(trimmed.encode("utf-8")) > _MAX_HEADER_BYTES:
        return None, "invalid"

    addresses = [
        address.strip()
        for _, address in getaddresses([trimmed])
        if address and address.strip()
    ]
    if len(addresses) > 1:
        return None, "multiple"
    if not addresses:
        return None, "invalid"
    candidate = addresses[0]
    if not _HEADER_ADDR_RE.fullmatch(candidate):
        return None, "invalid"
    return candidate.lower(), ""


def is_trusted_sender(
    event: EmailReceivedEvent | Mapping[str, Any],
    *,
    domain: str,
    sender: str | None = None,
) -> TrustedSenderResult:
    """Check whether an inbound email is authenticated as an expected domain.

    ``trusted`` is True only when ALL of the following hold:

    1. ``validate_email_auth(event.email.auth)`` returns a ``legit`` verdict.
    2. ``event.email.auth.dmarc_from_domain`` (the domain the server's
       DMARC evaluation ran against) equals ``domain``.
    3. The From header strict-parses to exactly one valid address whose
       domain equals ``domain``.
    4. When ``sender`` is given, the parsed From address equals it exactly
       (case-insensitive).

    The verdict alone says an email was authenticated, not which domain it
    was authenticated as: a fully authenticated email from an
    attacker-controlled domain is ``legit``. Anchoring ``dmarc_from_domain``
    closes that. The strict From parse defends the remaining gaps: a header
    like ``From: "trusted@example.com" <x@evil.com>`` plants an allowlisted
    address in the display name while DMARC evaluates ``evil.com``, and
    ``normalize_received_email().sender`` is not a safe anchor because its
    lenient parser falls back to the attacker-controlled SMTP envelope
    sender. Reply-To is likewise never consulted.

    Domains match exactly and case-insensitively; mail from a subdomain of
    ``domain`` does not match. An ``unknown`` verdict caused by a DMARC
    temperror is surfaced with ``retryable=True``; every other unknown
    (for example a sender domain with no DMARC record) is permanent for
    this email and not retryable.

    Never raises for malformed event content; malformed input yields an
    untrusted result with a reason. Raises ``ValueError`` only for invalid
    ``domain`` or ``sender`` arguments.
    """
    expected_domain = domain.strip().lower() if isinstance(domain, str) else ""
    if not expected_domain:
        raise ValueError("domain must be a non-empty domain name")
    if "@" in expected_domain or any(ch.isspace() for ch in expected_domain):
        raise ValueError("domain must be a bare domain name without @ or whitespace")

    expected_sender: str | None = None
    if sender is not None:
        expected_sender = sender.strip().lower()
        if not _HEADER_ADDR_RE.fullmatch(expected_sender):
            raise ValueError(
                "sender must be a single bare email address (user@example.com)"
            )

    auth_input: Any
    from_header: Any
    if isinstance(event, Mapping):
        email = event.get("email")
        auth_input = email.get("auth") if isinstance(email, Mapping) else None
        headers = email.get("headers") if isinstance(email, Mapping) else None
        from_header = headers.get("from") if isinstance(headers, Mapping) else None
    else:
        auth_input = event.email.auth
        from_header = event.email.headers.from_

    if isinstance(auth_input, EmailAuth):
        auth = auth_input
    elif isinstance(auth_input, Mapping):
        try:
            auth = EmailAuth.model_validate(auth_input, by_alias=True, by_name=True)
        except ValidationError:
            return _untrusted("auth-missing", _missing_auth_result())
    else:
        return _untrusted("auth-missing", _missing_auth_result())

    auth_result = validate_email_auth(auth)

    if auth_result.verdict == "suspicious":
        return _untrusted("auth-suspicious", auth_result)
    if auth_result.verdict == "unknown":
        # Only a DMARC temperror is transient. Every other unknown (no
        # DMARC record, permerror, no auth data) is permanent for this
        # email; marking those retryable would make callers 5xx forever
        # for senders whose domain simply publishes no DMARC record.
        if _enum_value(auth.dmarc) == "temperror":
            return _untrusted("dmarc-temperror", auth_result, retryable=True)
        return _untrusted("auth-unknown", auth_result)

    dmarc_from_domain = (
        auth.dmarc_from_domain.strip().lower()
        if isinstance(auth.dmarc_from_domain, str)
        else ""
    )
    if not dmarc_from_domain or dmarc_from_domain != expected_domain:
        return _untrusted("dmarc-domain-mismatch", auth_result)

    from_address, parse_failure = _parse_from_strict(
        from_header if isinstance(from_header, str) else None
    )
    if from_address is None:
        return _untrusted(
            "from-header-multiple-addresses"
            if parse_failure == "multiple"
            else "from-header-invalid",
            auth_result,
        )

    from_domain = from_address.rsplit("@", 1)[-1]
    if from_domain != expected_domain:
        return _untrusted("from-domain-mismatch", auth_result)

    if expected_sender is not None and from_address != expected_sender:
        return _untrusted("sender-mismatch", auth_result)

    return TrustedSenderResult(
        trusted=True, retryable=False, reason="trusted", auth=auth_result
    )
