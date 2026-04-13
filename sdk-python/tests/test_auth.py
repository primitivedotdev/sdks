from __future__ import annotations

from typing import Any

import pytest

from primitive import validate_email_auth
from primitive.types import EmailAuth


def create_base_auth(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    auth = {
        "spf": "pass",
        "dmarc": "pass",
        "dmarcPolicy": "none",
        "dmarcFromDomain": "example.com",
        "dmarcSpfAligned": True,
        "dmarcDkimAligned": True,
        "dmarcSpfStrict": False,
        "dmarcDkimStrict": False,
        "dkimSignatures": [],
    }
    if overrides:
        auth.update(overrides)
    return auth


def create_dkim_signature(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    signature = {
        "domain": "example.com",
        "selector": "default",
        "result": "pass",
        "aligned": True,
        "keyBits": 2048,
        "algo": "rsa-sha256",
    }
    if overrides:
        signature.update(overrides)
    return signature


def test_auth_legit_high_confidence_with_aligned_dkim() -> None:
    auth = create_base_auth(
        {
            "dmarc": "pass",
            "dmarcDkimAligned": True,
            "dkimSignatures": [create_dkim_signature({"result": "pass"})],
        }
    )

    result = validate_email_auth(auth)

    assert result.verdict == "legit"
    assert result.confidence == "high"
    assert "DMARC passed with DKIM alignment (example.com)" in result.reasons


def test_validate_email_auth_accepts_snake_case_mapping_keys() -> None:
    result = validate_email_auth(
        {
            "spf": "pass",
            "dmarc": "pass",
            "dmarc_policy": "none",
            "dmarc_from_domain": "example.com",
            "dmarc_spf_aligned": True,
            "dmarc_dkim_aligned": True,
            "dmarc_spf_strict": False,
            "dmarc_dkim_strict": False,
            "dkim_signatures": [
                {
                    "domain": "example.com",
                    "selector": "default",
                    "result": "pass",
                    "aligned": True,
                    "key_bits": 2048,
                    "algo": "rsa-sha256",
                }
            ],
        }
    )

    assert result.verdict == "legit"
    assert result.confidence == "high"


def test_auth_legit_high_confidence_with_multiple_aligned_dkim() -> None:
    auth = create_base_auth(
        {
            "dkimSignatures": [
                create_dkim_signature({"domain": "example.com", "aligned": True}),
                create_dkim_signature({"domain": "mail.example.com", "aligned": True}),
            ]
        }
    )
    result = validate_email_auth(auth)
    assert result.verdict == "legit"
    assert result.confidence == "high"
    assert "example.com" in result.reasons[0]
    assert "mail.example.com" in result.reasons[0]


def test_auth_ignores_non_aligned_dkim_for_alignment_reason() -> None:
    auth = create_base_auth(
        {
            "dkimSignatures": [
                create_dkim_signature({"domain": "other.com", "aligned": False}),
                create_dkim_signature({"domain": "example.com", "aligned": True}),
            ]
        }
    )
    result = validate_email_auth(auth)
    assert "other.com" not in result.reasons[0]
    assert "example.com" in result.reasons[0]


def test_auth_legit_medium_confidence_with_spf_only() -> None:
    auth = create_base_auth(
        {
            "spf": "pass",
            "dmarc": "pass",
            "dmarcSpfAligned": True,
            "dmarcDkimAligned": False,
            "dkimSignatures": [],
        }
    )

    result = validate_email_auth(auth)

    assert result.verdict == "legit"
    assert result.confidence == "medium"
    assert "DMARC passed with SPF alignment" in result.reasons
    assert any("SPF can break" in reason for reason in result.reasons)


def test_auth_legit_medium_confidence_when_edge_case_dmarc_pass() -> None:
    auth = create_base_auth(
        {
            "dmarcSpfAligned": False,
            "dmarcDkimAligned": False,
        }
    )
    result = validate_email_auth(auth)
    assert result.verdict == "legit"
    assert result.confidence == "medium"
    assert "DMARC passed" in result.reasons


def test_auth_weak_dkim_key_downgrades_confidence() -> None:
    auth = create_base_auth(
        {
            "dmarc": "pass",
            "dmarcDkimAligned": True,
            "dkimSignatures": [create_dkim_signature({"keyBits": 512})],
        }
    )

    result = validate_email_auth(auth)

    assert result.verdict == "legit"
    assert result.confidence == "medium"
    assert any("Weak DKIM key (512 bits)" in reason for reason in result.reasons)


def test_auth_multiple_weak_keys_reported() -> None:
    auth = create_base_auth(
        {
            "dmarc": "pass",
            "dmarcDkimAligned": True,
            "dkimSignatures": [
                create_dkim_signature({"domain": "a.com", "keyBits": 512}),
                create_dkim_signature({"domain": "b.com", "keyBits": 768}),
            ],
        }
    )

    result = validate_email_auth(auth)

    assert result.confidence == "medium"
    assert len([reason for reason in result.reasons if "Weak" in reason]) == 2


def test_auth_1024_and_null_key_bits_are_not_flagged_as_weak() -> None:
    auth_1024 = create_base_auth({"dkimSignatures": [create_dkim_signature({"keyBits": 1024})]})
    auth_null = create_base_auth({"dkimSignatures": [create_dkim_signature({"keyBits": None})]})
    result_1024 = validate_email_auth(auth_1024)
    result_null = validate_email_auth(auth_null)
    assert result_1024.confidence == "high"
    assert result_null.confidence == "high"
    assert not any("Weak" in reason for reason in result_1024.reasons)
    assert not any("Weak" in reason for reason in result_null.reasons)


def test_auth_suspicious_high_confidence_quarantine_policy() -> None:
    result = validate_email_auth(
        create_base_auth({"dmarc": "fail", "dmarcPolicy": "quarantine"})
    )
    assert result.verdict == "suspicious"
    assert result.confidence == "high"
    assert "DMARC failed and domain has quarantine policy" in result.reasons


def test_auth_suspicious_high_confidence_reject_policy() -> None:
    auth = create_base_auth({"dmarc": "fail", "dmarcPolicy": "reject"})

    result = validate_email_auth(auth)

    assert result.verdict == "suspicious"
    assert result.confidence == "high"
    assert "DMARC failed and domain has reject policy" in result.reasons
    assert any("explicitly rejects" in reason for reason in result.reasons)


def test_auth_suspicious_medium_confidence_no_dmarc_with_spf_fail() -> None:
    auth = create_base_auth(
        {
            "spf": "fail",
            "dmarc": "none",
            "dmarcPolicy": None,
        }
    )

    result = validate_email_auth(auth)

    assert result.verdict == "suspicious"
    assert result.confidence == "medium"
    assert "No DMARC record for sender domain" in result.reasons
    assert any("SPF failed" in reason for reason in result.reasons)


def test_auth_suspicious_low_confidence_monitoring_mode() -> None:
    auth = create_base_auth(
        {
            "spf": "pass",
            "dmarc": "fail",
            "dmarcPolicy": "none",
        }
    )

    result = validate_email_auth(auth)

    assert result.verdict == "suspicious"
    assert result.confidence == "low"
    assert "DMARC failed (domain is in monitoring mode)" in result.reasons


def test_auth_unknown_with_no_dmarc_and_dkim_pass() -> None:
    auth = create_base_auth(
        {
            "spf": "pass",
            "dmarc": "none",
            "dmarcPolicy": None,
            "dkimSignatures": [create_dkim_signature({"result": "pass"})],
        }
    )

    result = validate_email_auth(auth)

    assert result.verdict == "unknown"
    assert result.confidence == "low"
    assert "No DMARC record for sender domain" in result.reasons
    assert any("DKIM verified" in reason for reason in result.reasons)
    assert "SPF passed" in result.reasons


@pytest.mark.parametrize("spf_result", ["softfail", "neutral", "none"])
def test_auth_unknown_handles_spf_variations(spf_result: str) -> None:
    result = validate_email_auth(
        create_base_auth(
            {
                "spf": spf_result,
                "dmarc": "none",
                "dmarcPolicy": None,
                "dkimSignatures": [],
            }
        )
    )
    assert result.verdict == "unknown"


def test_auth_unknown_with_only_spf_pass_mentions_weakness() -> None:
    result = validate_email_auth(
        create_base_auth(
            {
                "spf": "pass",
                "dmarc": "none",
                "dmarcPolicy": None,
                "dkimSignatures": [],
            }
        )
    )
    assert result.verdict == "unknown"
    assert "No DKIM signatures present" in result.reasons
    assert any("SPF alone is weak" in reason for reason in result.reasons)


def test_auth_suspicious_medium_confidence_when_monitoring_mode_and_spf_fails() -> None:
    result = validate_email_auth(
        create_base_auth(
            {
                "spf": "fail",
                "dmarc": "fail",
                "dmarcPolicy": "none",
            }
        )
    )
    assert result.verdict == "suspicious"
    assert result.confidence == "medium"
    assert "SPF failed - sending IP not authorized" in result.reasons


def test_auth_falls_back_for_unknown_dmarc_values() -> None:
    result = validate_email_auth(
        EmailAuth.model_construct(**create_base_auth({"dmarc": "mystery"}))
    )
    assert result.verdict == "unknown"
    assert result.confidence == "low"
    assert result.reasons == ["Unable to determine email authenticity"]


def test_auth_unknown_with_no_authentication() -> None:
    result = validate_email_auth(
        create_base_auth(
            {
                "spf": "none",
                "dmarc": "none",
                "dmarcPolicy": None,
                "dkimSignatures": [],
            }
        )
    )
    assert result.verdict == "unknown"
    assert "No valid authentication found" in result.reasons


def test_auth_unknown_for_dmarc_temperror() -> None:
    auth = create_base_auth({"dmarc": "temperror"})

    result = validate_email_auth(auth)

    assert result.verdict == "unknown"
    assert result.confidence == "low"
    assert any("temperror" in reason for reason in result.reasons)
    assert any("DNS or policy errors" in reason for reason in result.reasons)


def test_auth_unknown_for_dmarc_permerror() -> None:
    result = validate_email_auth(create_base_auth({"dmarc": "permerror"}))
    assert result.verdict == "unknown"
    assert any("permerror" in reason for reason in result.reasons)


def test_auth_includes_spf_error_without_changing_legit_verdict() -> None:
    auth = create_base_auth(
        {
            "spf": "permerror",
            "dmarc": "pass",
            "dmarcDkimAligned": True,
            "dkimSignatures": [create_dkim_signature({"result": "pass"})],
        }
    )

    result = validate_email_auth(auth)

    assert result.verdict == "legit"
    assert any("SPF verification error" in reason for reason in result.reasons)


@pytest.mark.parametrize("dkim_result", ["temperror", "permerror"])
def test_auth_handles_dkim_result_variations_with_spf_fallback(dkim_result: str) -> None:
    auth = create_base_auth(
        {
            "spf": "pass",
            "dmarc": "pass",
            "dmarcSpfAligned": True,
            "dmarcDkimAligned": False,
            "dkimSignatures": [create_dkim_signature({"result": dkim_result})],
        }
    )
    result = validate_email_auth(auth)
    assert result.verdict == "legit"
    assert result.confidence == "medium"


def test_auth_falls_back_to_spf_when_aligned_dkim_fails() -> None:
    auth = create_base_auth(
        {
            "spf": "pass",
            "dmarc": "pass",
            "dmarcSpfAligned": True,
            "dmarcDkimAligned": True,
            "dkimSignatures": [create_dkim_signature({"result": "fail"})],
        }
    )

    result = validate_email_auth(auth)

    assert result.verdict == "legit"
    assert result.confidence == "medium"
    assert "DMARC passed with SPF alignment" in result.reasons


def test_auth_handles_empty_dkim_signatures_when_dmarc_dkim_aligned_true() -> None:
    result = validate_email_auth(
        create_base_auth(
            {
                "spf": "pass",
                "dmarc": "pass",
                "dmarcSpfAligned": True,
                "dmarcDkimAligned": True,
                "dkimSignatures": [],
            }
        )
    )
    assert result.verdict == "legit"


def test_auth_real_world_gmail_like_case() -> None:
    auth = {
        "spf": "pass",
        "dmarc": "pass",
        "dmarcPolicy": "reject",
        "dmarcFromDomain": "gmail.com",
        "dmarcSpfAligned": True,
        "dmarcDkimAligned": True,
        "dmarcSpfStrict": False,
        "dmarcDkimStrict": False,
        "dkimSignatures": [
            {
                "domain": "gmail.com",
                "selector": "20230601",
                "result": "pass",
                "aligned": True,
                "keyBits": 2048,
                "algo": "rsa-sha256",
            }
        ],
    }
    result = validate_email_auth(auth)
    assert result.verdict == "legit"
    assert result.confidence == "high"


def test_auth_real_world_resend_case() -> None:
    auth = {
        "spf": "pass",
        "dmarc": "pass",
        "dmarcPolicy": "none",
        "dmarcFromDomain": "example.com",
        "dmarcSpfAligned": False,
        "dmarcDkimAligned": True,
        "dmarcSpfStrict": False,
        "dmarcDkimStrict": False,
        "dkimSignatures": [
            {
                "domain": "resend.dev",
                "selector": "resend",
                "result": "pass",
                "aligned": False,
                "keyBits": 1024,
                "algo": "rsa-sha256",
            },
            {
                "domain": "example.com",
                "selector": "resend",
                "result": "pass",
                "aligned": True,
                "keyBits": 1024,
                "algo": "rsa-sha256",
            },
        ],
    }
    result = validate_email_auth(auth)
    assert result.verdict == "legit"
    assert result.confidence == "high"


def test_auth_real_world_amazon_ses_case() -> None:
    auth = {
        "spf": "pass",
        "dmarc": "pass",
        "dmarcPolicy": "quarantine",
        "dmarcFromDomain": "example.com",
        "dmarcSpfAligned": True,
        "dmarcDkimAligned": True,
        "dmarcSpfStrict": False,
        "dmarcDkimStrict": False,
        "dkimSignatures": [
            {
                "domain": "amazonses.com",
                "selector": "abc123",
                "result": "pass",
                "aligned": False,
                "keyBits": 1024,
                "algo": "rsa-sha256",
            },
            {
                "domain": "example.com",
                "selector": "ses123",
                "result": "pass",
                "aligned": True,
                "keyBits": 1024,
                "algo": "rsa-sha256",
            },
        ],
    }
    result = validate_email_auth(auth)
    assert result.verdict == "legit"
    assert result.confidence == "high"


def test_auth_real_world_phishing_attempt() -> None:
    auth = {
        "spf": "fail",
        "dmarc": "fail",
        "dmarcPolicy": "reject",
        "dmarcFromDomain": "paypal.com",
        "dmarcSpfAligned": False,
        "dmarcDkimAligned": False,
        "dmarcSpfStrict": True,
        "dmarcDkimStrict": True,
        "dkimSignatures": [],
    }
    result = validate_email_auth(auth)
    assert result.verdict == "suspicious"
    assert result.confidence == "high"
    assert any("reject" in reason for reason in result.reasons)


def test_auth_real_world_legacy_domain_without_dmarc() -> None:
    auth = {
        "spf": "pass",
        "dmarc": "none",
        "dmarcPolicy": None,
        "dmarcFromDomain": None,
        "dmarcSpfAligned": False,
        "dmarcDkimAligned": False,
        "dmarcSpfStrict": None,
        "dmarcDkimStrict": None,
        "dkimSignatures": [],
    }
    result = validate_email_auth(auth)
    assert result.verdict == "unknown"
    assert result.confidence == "low"


def test_auth_real_world_forwarded_email_where_spf_breaks() -> None:
    auth = {
        "spf": "fail",
        "dmarc": "pass",
        "dmarcPolicy": "none",
        "dmarcFromDomain": "original.com",
        "dmarcSpfAligned": False,
        "dmarcDkimAligned": True,
        "dmarcSpfStrict": False,
        "dmarcDkimStrict": False,
        "dkimSignatures": [
            {
                "domain": "original.com",
                "selector": "key1",
                "result": "pass",
                "aligned": True,
                "keyBits": 2048,
                "algo": "rsa-sha256",
            }
        ],
    }
    result = validate_email_auth(auth)
    assert result.verdict == "legit"
    assert result.confidence == "high"


def test_auth_real_world_mailing_list_email() -> None:
    auth = {
        "spf": "pass",
        "dmarc": "fail",
        "dmarcPolicy": "none",
        "dmarcFromDomain": "list.example.org",
        "dmarcSpfAligned": True,
        "dmarcDkimAligned": False,
        "dmarcSpfStrict": False,
        "dmarcDkimStrict": False,
        "dkimSignatures": [
            {
                "domain": "list.example.org",
                "selector": "list",
                "result": "pass",
                "aligned": False,
                "keyBits": 2048,
                "algo": "rsa-sha256",
            }
        ],
    }
    result = validate_email_auth(auth)
    assert result.verdict == "suspicious"
    assert result.confidence == "low"


@pytest.mark.parametrize("strict_value", [True, False, None])
def test_auth_alignment_modes_do_not_break_legit_result(strict_value: bool | None) -> None:
    auth = create_base_auth(
        {
            "dmarc": "pass",
            "dmarcDkimAligned": True,
            "dmarcDkimStrict": strict_value,
            "dmarcSpfStrict": strict_value,
            "dkimSignatures": [create_dkim_signature({"result": "pass", "aligned": True})],
        }
    )
    result = validate_email_auth(auth)
    assert result.verdict == "legit"


def test_auth_dmarc_from_domain_subdomain_lookup_case() -> None:
    auth = create_base_auth(
        {
            "dmarc": "pass",
            "dmarcFromDomain": "primitive.dev",
            "dmarcDkimAligned": True,
            "dkimSignatures": [
                create_dkim_signature(
                    {
                        "domain": "primitive.dev",
                        "result": "pass",
                        "aligned": True,
                    }
                )
            ],
        }
    )
    result = validate_email_auth(auth)
    assert result.verdict == "legit"
    assert result.confidence == "high"


def test_auth_handles_null_dmarc_from_domain() -> None:
    result = validate_email_auth(create_base_auth({"dmarc": "none", "dmarcFromDomain": None}))
    assert result.verdict == "unknown"
