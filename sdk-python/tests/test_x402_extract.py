from __future__ import annotations

import json
from typing import Any

import pytest

from primitive import X402Error, extract_email_challenge

# The challenge-step interaction.json an inbound payer email carries. Its step_id
# is the challenge step id (a nonce-binding input), and the payload carries the
# challenge_nonce + payment_requirements the payer signs over. The platform's
# private challenge id is NOT on the wire.
INTERACTION_ID = "a1b2c3d4-0000-0000-0000-000000000001@payer.example"
CHALLENGE_STEP_ID = "f00dface-0000-0000-0000-0000000000aa"
CHALLENGE_NONCE = (
    "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
)


def _valid_envelope() -> dict[str, Any]:
    return {
        "interaction_version": 1,
        "interaction_id": INTERACTION_ID,
        "protocol": "x402.payment",
        "protocol_version": 1,
        "step": "challenge",
        "step_id": CHALLENGE_STEP_ID,
        "prev_step_id": None,
        "expires_at": "2030-01-01T00:00:00.000Z",
        "payload": {
            "challenge_nonce": CHALLENGE_NONCE,
            "payment_requirements": {
                "scheme": "exact",
                "network": "base-sepolia",
                "maxAmountRequired": "10000",
                "payTo": "0x1111111111111111111111111111111111111111",
                "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                "extra": {"name": "USDC", "version": "2"},
            },
        },
    }


class TestExtractEmailChallenge:
    def test_round_trips_a_real_challenge_part_to_a_typed_challenge(self) -> None:
        challenge = extract_email_challenge(json.dumps(_valid_envelope()))
        assert challenge.interaction_id == INTERACTION_ID
        # The challenge id is not carried on the wire; pay_email_challenge does
        # not need it (it binds to interaction_id + the challenge step id).
        assert challenge.challenge_id == ""
        assert challenge.challenge.expires_at == "2030-01-01T00:00:00.000Z"
        assert challenge.challenge.nonce_binding == {
            "interaction_id": INTERACTION_ID,
            "challenge_step_id": CHALLENGE_STEP_ID,
            "challenge_nonce": CHALLENGE_NONCE,
        }
        assert (
            challenge.challenge.payment_requirements.max_amount_required == "10000"
        )

    def test_accepts_bytes_and_a_parsed_dict(self) -> None:
        raw = json.dumps(_valid_envelope()).encode("utf-8")
        assert extract_email_challenge(raw).interaction_id == INTERACTION_ID
        assert (
            extract_email_challenge(_valid_envelope()).interaction_id
            == INTERACTION_ID
        )

    def test_rejects_non_json_bytes(self) -> None:
        with pytest.raises(X402Error, match="not valid JSON"):
            extract_email_challenge("not json {")

    def test_rejects_invalid_utf8_bytes_as_x402_error(self) -> None:
        # Invalid UTF-8 must surface as the documented X402Error, not a raw
        # UnicodeDecodeError, so callers guarding `except X402Error` catch it.
        with pytest.raises(X402Error, match="not valid JSON"):
            extract_email_challenge(b"\xff\xfe\x00bad")

    def test_rejects_a_non_challenge_step(self) -> None:
        env = _valid_envelope()
        env["step"] = "payment"
        with pytest.raises(X402Error, match='step \\(expected "challenge"'):
            extract_email_challenge(json.dumps(env))

    def test_rejects_the_wrong_protocol(self) -> None:
        env = _valid_envelope()
        env["protocol"] = "something.else"
        with pytest.raises(X402Error, match="protocol"):
            extract_email_challenge(json.dumps(env))

    def test_rejects_a_malformed_challenge_nonce(self) -> None:
        env = _valid_envelope()
        env["payload"]["challenge_nonce"] = "tooshort"
        with pytest.raises(X402Error, match="challenge_nonce"):
            extract_email_challenge(json.dumps(env))

    def test_rejects_a_malformed_interaction_id(self) -> None:
        env = _valid_envelope()
        env["interaction_id"] = "not-a-wire-id"
        with pytest.raises(X402Error, match="interaction_id"):
            extract_email_challenge(json.dumps(env))

    def test_rejects_malformed_payment_requirements(self) -> None:
        env = _valid_envelope()
        env["payload"]["payment_requirements"]["maxAmountRequired"] = "0"
        with pytest.raises(X402Error, match="maxAmountRequired"):
            extract_email_challenge(json.dumps(env))
