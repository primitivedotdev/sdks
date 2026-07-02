from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from primitive import (
    is_trusted_sender,
    normalize_received_email,
    validate_email_received_event,
)


def _fixtures_root() -> Path:
    current = Path(__file__).resolve()
    candidates = (
        current.parents[2] / "test-fixtures",
        current.parents[1] / "test-fixtures",
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Could not locate shared test-fixtures directory")


BASE_EVENT: dict[str, Any] = json.loads(
    (_fixtures_root() / "webhook" / "valid-email-received.json").read_text()
)


def _legit_auth(**overrides: Any) -> dict[str, Any]:
    auth: dict[str, Any] = {
        "spf": "pass",
        "dmarc": "pass",
        "dmarcPolicy": "reject",
        "dmarcFromDomain": "example.com",
        "dmarcSpfAligned": True,
        "dmarcDkimAligned": True,
        "dmarcSpfStrict": False,
        "dmarcDkimStrict": False,
        "dkimSignatures": [
            {
                "domain": "example.com",
                "selector": "default",
                "result": "pass",
                "aligned": True,
                "keyBits": 2048,
                "algo": "rsa-sha256",
            }
        ],
    }
    auth.update(overrides)
    return auth


def _build_event(
    *,
    from_header: str | None = None,
    mail_from: str | None = None,
    auth: dict[str, Any] | None = None,
) -> dict[str, Any]:
    event = copy.deepcopy(BASE_EVENT)
    if from_header is not None:
        event["email"]["headers"]["from"] = from_header
    if mail_from is not None:
        event["email"]["smtp"]["mail_from"] = mail_from
    event["email"]["auth"] = auth if auth is not None else _legit_auth()
    return event


def test_trusts_authenticated_mail_from_expected_domain() -> None:
    result = is_trusted_sender(
        _build_event(from_header="sender@example.com"), domain="example.com"
    )
    assert result.trusted is True
    assert result.retryable is False
    assert result.reason == "trusted"
    assert result.auth.verdict == "legit"


def test_accepts_typed_event() -> None:
    event = validate_email_received_event(
        _build_event(from_header="sender@example.com")
    )
    result = is_trusted_sender(event, domain="example.com")
    assert result.trusted is True


def test_unparseable_from_is_untrusted_even_when_envelope_matches() -> None:
    # normalize_received_email falls back to smtp.mail_from when the From
    # header fails to parse; that fallback is attacker-controlled and must
    # never satisfy the trust check.
    event = _build_event(from_header="not-an-email", mail_from="sender@example.com")
    typed = validate_email_received_event(event)
    assert normalize_received_email(typed).sender.address == "sender@example.com"
    result = is_trusted_sender(event, domain="example.com")
    assert result.trusted is False
    assert result.reason == "from-header-invalid"


def test_missing_auth_is_untrusted_instead_of_raising() -> None:
    event = _build_event(from_header="sender@example.com")
    del event["email"]["auth"]
    result = is_trusted_sender(event, domain="example.com")
    assert result.trusted is False
    assert result.retryable is False
    assert result.reason == "auth-missing"
    assert result.auth.verdict == "unknown"


def test_malformed_auth_is_untrusted_instead_of_raising() -> None:
    event = _build_event(from_header="sender@example.com")
    event["email"]["auth"] = {"spf": "not-a-result"}
    result = is_trusted_sender(event, domain="example.com")
    assert result.reason == "auth-missing"


def test_whitespace_padded_dmarc_from_domain_is_normalized() -> None:
    result = is_trusted_sender(
        _build_event(
            from_header="sender@example.com",
            auth=_legit_auth(dmarcFromDomain=" Example.com "),
        ),
        domain="example.com",
    )
    assert result.trusted is True


def test_group_syntax_from_is_rejected() -> None:
    # getaddresses flattens a single-member group to its member, so the
    # explicit group-delimiter guard must reject it to stay aligned with
    # the Node parser.
    result = is_trusted_sender(
        _build_event(from_header="Friends: sender@example.com;"),
        domain="example.com",
    )
    assert result.trusted is False
    assert result.reason == "from-header-invalid"


def test_quoted_colon_display_name_is_not_a_group() -> None:
    result = is_trusted_sender(
        _build_event(from_header='"Support: Billing" <sender@example.com>'),
        domain="example.com",
    )
    assert result.trusted is True


def test_escaped_quote_in_display_name_keeps_colon_quoted() -> None:
    result = is_trusted_sender(
        _build_event(from_header='"a\\": b" <sender@example.com>'),
        domain="example.com",
    )
    assert result.trusted is True


def test_ipv6_domain_literal_is_rejected() -> None:
    # The colon inside the domain literal trips the group-delimiter
    # guard, matching the Node parser (whose lexer also treats it as a
    # group marker).
    result = is_trusted_sender(
        _build_event(from_header="user@[IPv6:2001:db8::1]"),
        domain="example.com",
    )
    assert result.trusted is False
    assert result.reason == "from-header-invalid"


def test_invalid_options_raise_value_error() -> None:
    event = _build_event(from_header="sender@example.com")
    with pytest.raises(ValueError):
        is_trusted_sender(event, domain="  ")
    with pytest.raises(ValueError):
        is_trusted_sender(event, domain="user@example.com")
    with pytest.raises(ValueError):
        is_trusted_sender(event, domain="example.com", sender="not-an-email")
    with pytest.raises(ValueError):
        is_trusted_sender(
            event, domain="example.com", sender="Name <sender@example.com>"
        )
