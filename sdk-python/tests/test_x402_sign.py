from __future__ import annotations

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct, encode_typed_data

from primitive import (
    DEFAULT_MAX_WINDOW_SEC,
    DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC,
    NonceBinding,
    PayoutRegistrationMessageInput,
    PrivateKeySigner,
    TokenDomain,
    TransferAuthorization,
    build_exact_evm_payment_payload,
    build_payout_registration_message,
    compute_payment_validity_window,
    derive_eip3009_nonce,
    sign_interaction_payment,
    to_payment_payload,
    transfer_with_authorization_typed_data,
)

# Canonical binding + the NORMATIVE nonce the platform verifier recomputes. This
# value MUST stay identical to the server's vector, or every payment fails
# verification. Do not change it without changing the server in lockstep.
CANONICAL = NonceBinding(
    interaction_id="a1b2c3d4-0000-0000-0000-000000000001@payer.example",
    challenge_step_id="f00dface-0000-0000-0000-0000000000aa",
    challenge_nonce=(
        "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
    ),
)
NORMATIVE_NONCE = "0xc955a08812ab83f9e25c92e5162267b913957c3cc8678de1cf1449f77b516c6e"

# Standard Hardhat/anvil test key -> known address.
TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


class TestDeriveEip3009Nonce:
    def test_matches_the_normative_platform_vector_to_the_byte(self) -> None:
        assert derive_eip3009_nonce(CANONICAL) == NORMATIVE_NONCE

    def test_is_case_insensitive_over_the_identifiers(self) -> None:
        upper = NonceBinding(
            interaction_id=CANONICAL.interaction_id.upper(),
            challenge_step_id=CANONICAL.challenge_step_id.upper(),
            challenge_nonce=CANONICAL.challenge_nonce,
        )
        assert derive_eip3009_nonce(upper) == NORMATIVE_NONCE

    def test_changes_when_any_binding_field_changes(self) -> None:
        other = derive_eip3009_nonce(
            NonceBinding(
                interaction_id=CANONICAL.interaction_id,
                challenge_step_id="f00dface-0000-0000-0000-0000000000ab",
                challenge_nonce=CANONICAL.challenge_nonce,
            )
        )
        assert other != NORMATIVE_NONCE

    def test_rejects_a_malformed_challenge_nonce(self) -> None:
        with pytest.raises(ValueError):
            derive_eip3009_nonce(
                NonceBinding(
                    interaction_id=CANONICAL.interaction_id,
                    challenge_step_id=CANONICAL.challenge_step_id,
                    challenge_nonce="xyz",
                )
            )
        with pytest.raises(ValueError):
            derive_eip3009_nonce(
                NonceBinding(
                    interaction_id=CANONICAL.interaction_id,
                    challenge_step_id=CANONICAL.challenge_step_id,
                    challenge_nonce=CANONICAL.challenge_nonce.upper(),
                )
            )


class TestTransferWithAuthorizationTypedData:
    def _auth(self) -> TransferAuthorization:
        return TransferAuthorization(
            from_="0x2222222222222222222222222222222222222222",
            to="0x1111111111111111111111111111111111111111",
            value=10000,
            valid_after=1,
            valid_before=99999,
            nonce=NORMATIVE_NONCE,
        )

    def test_builds_the_eip712_struct_with_the_fixed_field_order(self) -> None:
        td = transfer_with_authorization_typed_data(
            TokenDomain(
                name="USDC",
                version="2",
                chain_id=84532,
                verifying_contract="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            ),
            self._auth(),
        )
        assert td["primaryType"] == "TransferWithAuthorization"
        assert td["domain"]["name"] == "USDC"
        assert td["domain"]["version"] == "2"
        assert td["domain"]["chainId"] == 84532
        names = [f["name"] for f in td["types"]["TransferWithAuthorization"]]
        assert names == [
            "from",
            "to",
            "value",
            "validAfter",
            "validBefore",
            "nonce",
        ]

    def test_eip712_signature_recovers_the_signer_address(self) -> None:
        signer = PrivateKeySigner(TEST_KEY)
        assert signer.address == TEST_ADDRESS
        auth = TransferAuthorization(
            from_=signer.address,
            to="0x1111111111111111111111111111111111111111",
            value=10000,
            valid_after=1,
            valid_before=99999,
            nonce=NORMATIVE_NONCE,
        )
        td = transfer_with_authorization_typed_data(
            TokenDomain(
                name="USDC",
                version="2",
                chain_id=84532,
                verifying_contract="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            ),
            auth,
        )
        signature = signer.sign_typed_data(td)
        assert signature.startswith("0x")
        signable = encode_typed_data(full_message=td)
        recovered = Account.recover_message(
            signable, signature=bytes.fromhex(signature[2:])
        )
        assert recovered == TEST_ADDRESS


class TestToPaymentPayload:
    def test_stringifies_the_numeric_fields_for_the_wire(self) -> None:
        auth = TransferAuthorization(
            from_="0x2222222222222222222222222222222222222222",
            to="0x1111111111111111111111111111111111111111",
            value=10000,
            valid_after=1,
            valid_before=99999,
            nonce=NORMATIVE_NONCE,
        )
        p = to_payment_payload("base-sepolia", auth, "0xdeadbeef").to_dict()
        assert p["x402Version"] == 1
        assert p["scheme"] == "exact"
        assert p["network"] == "base-sepolia"
        assert p["payload"]["signature"] == "0xdeadbeef"
        authz = p["payload"]["authorization"]
        assert authz["value"] == "10000"
        assert authz["validAfter"] == "1"
        assert authz["validBefore"] == "99999"
        assert authz["nonce"] == NORMATIVE_NONCE


class TestBuildPayoutRegistrationMessage:
    def test_builds_the_byte_identical_platform_message(self) -> None:
        msg = build_payout_registration_message(
            PayoutRegistrationMessageInput(
                org="11111111-1111-4111-8111-111111111111",
                address="0x2222222222222222222222222222222222222222",
                network="base-sepolia",
                issued_at="2026-01-01T00:00:00.000Z",
            )
        )
        assert msg == (
            "Primitive x402 payout address authorization\n\n"
            "I authorize this address as a payout destination for my "
            "Primitive organization.\n\n"
            "org: 11111111-1111-4111-8111-111111111111\n"
            "address: 0x2222222222222222222222222222222222222222\n"
            "network: base-sepolia\n"
            "issued: 2026-01-01T00:00:00.000Z"
        )

    def test_lowercases_the_address_in_the_signed_bytes(self) -> None:
        msg = build_payout_registration_message(
            PayoutRegistrationMessageInput(
                org="o",
                address="0xAbCdEf0000000000000000000000000000000000",
                network="base",
                issued_at="t",
            )
        )
        assert "address: 0xabcdef0000000000000000000000000000000000" in msg

    def test_personal_sign_round_trips_to_the_signer_address(self) -> None:
        signer = PrivateKeySigner(TEST_KEY)
        msg = build_payout_registration_message(
            PayoutRegistrationMessageInput(
                org="11111111-1111-4111-8111-111111111111",
                address=signer.address,
                network="base-sepolia",
                issued_at="2026-01-01T00:00:00.000Z",
            )
        )
        signature = signer.sign_message(msg)
        assert signature.startswith("0x")
        recovered = Account.recover_message(
            encode_defunct(text=msg), signature=bytes.fromhex(signature[2:])
        )
        assert recovered == TEST_ADDRESS


class TestComputePaymentValidityWindow:
    def test_sets_valid_before_to_expiry_plus_margin_and_after_to_now_minus_skew(
        self,
    ) -> None:
        valid_after, valid_before = compute_payment_validity_window(
            challenge_expires_at_sec=2000,
            now_sec=1000,
            settlement_margin_sec=300,
            clock_skew_sec=120,
        )
        assert valid_before == 2300
        assert valid_after == 880

    def test_uses_minute_scale_defaults(self) -> None:
        valid_after, valid_before = compute_payment_validity_window(
            challenge_expires_at_sec=2000, now_sec=1000
        )
        assert valid_before == 2000 + 300
        assert valid_after == 1000 - 300

    def test_clamps_a_too_tight_window_up_to_the_headroom_floor(self) -> None:
        # The challenge already expired, so expiry + margin lands in the past:
        # the raw valid_before is below now. The default path clamps it up to
        # now + min_headroom rather than raising, so the payer gets a signable
        # window instead of a guaranteed rejection.
        now = 100000
        valid_after, valid_before = compute_payment_validity_window(
            challenge_expires_at_sec=1000,
            now_sec=now,
            settlement_margin_sec=60,
            clock_skew_sec=60,
        )
        assert valid_before == now + DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC
        assert valid_before > valid_after
        assert valid_before - valid_after <= DEFAULT_MAX_WINDOW_SEC

    def test_clamps_a_too_wide_window_down_to_the_cap(self) -> None:
        now = 1000
        valid_after, valid_before = compute_payment_validity_window(
            challenge_expires_at_sec=now + 48 * 60 * 60,  # 48h out, past the cap
            now_sec=now,
        )
        assert valid_before - valid_after == DEFAULT_MAX_WINDOW_SEC
        assert valid_before >= now + DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC

    def test_rejects_a_pinned_too_tight_valid_before_when_clamp_off(self) -> None:
        with pytest.raises(ValueError, match="settlement headroom"):
            compute_payment_validity_window(
                challenge_expires_at_sec=1600,
                now_sec=1000,
                valid_before_sec=1005,  # only 5s headroom, below the 60s floor
                clamp=False,
            )

    def test_rejects_a_pinned_too_wide_valid_before_when_clamp_off(self) -> None:
        with pytest.raises(ValueError, match="window is too wide"):
            compute_payment_validity_window(
                challenge_expires_at_sec=1600,
                now_sec=1000,
                valid_before_sec=1000 + 48 * 60 * 60,
                clamp=False,
            )

    def test_clamps_a_pinned_out_of_band_valid_before_when_clamp_on(self) -> None:
        now = 1000
        _, tight = compute_payment_validity_window(
            challenge_expires_at_sec=now + 600,
            now_sec=now,
            valid_before_sec=now + 5,
        )
        assert tight == now + DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC
        after, wide = compute_payment_validity_window(
            challenge_expires_at_sec=now + 600,
            now_sec=now,
            valid_before_sec=now + 48 * 60 * 60,
        )
        assert wide - after == DEFAULT_MAX_WINDOW_SEC

    def test_accepts_a_pinned_in_band_valid_before_under_clamp_false(self) -> None:
        now = 1000
        _, valid_before = compute_payment_validity_window(
            challenge_expires_at_sec=now + 600,
            now_sec=now,
            valid_before_sec=now + 900,
            clamp=False,
        )
        assert valid_before == now + 900


class TestSignInteractionPayment:
    _DOMAIN = TokenDomain(
        name="USDC",
        version="2",
        chain_id=84532,
        verifying_contract="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    )
    _PAY_TO = "0x1111111111111111111111111111111111111111"

    def test_injects_the_interaction_bound_nonce_not_a_random_one(self) -> None:
        signer = PrivateKeySigner(TEST_KEY)
        authorization, _ = sign_interaction_payment(
            sign=signer.sign_typed_data,
            payer=signer.address,
            domain=self._DOMAIN,
            pay_to=self._PAY_TO,
            amount=10000,
            nonce_binding=CANONICAL,
            valid_after=1,
            valid_before=99_999_999,
        )
        # The bound nonce for CANONICAL is the locked normative vector.
        assert authorization.nonce == NORMATIVE_NONCE

    def test_eip712_signature_recovers_the_signer(self) -> None:
        signer = PrivateKeySigner(TEST_KEY)
        authorization, signature = sign_interaction_payment(
            sign=signer.sign_typed_data,
            payer=signer.address,
            domain=self._DOMAIN,
            pay_to=self._PAY_TO,
            amount=10000,
            nonce_binding=CANONICAL,
            valid_after=1,
            valid_before=99_999_999,
        )
        td = transfer_with_authorization_typed_data(self._DOMAIN, authorization)
        signable = encode_typed_data(full_message=td)
        recovered = Account.recover_message(
            signable, signature=bytes.fromhex(signature[2:])
        )
        assert recovered == TEST_ADDRESS

    def test_sets_from_to_value_as_given(self) -> None:
        signer = PrivateKeySigner(TEST_KEY)
        authorization, _ = sign_interaction_payment(
            sign=signer.sign_typed_data,
            payer=signer.address,
            domain=self._DOMAIN,
            pay_to=self._PAY_TO,
            amount=10000,
            nonce_binding=CANONICAL,
            valid_after=1,
            valid_before=99_999_999,
        )
        assert authorization.from_ == TEST_ADDRESS
        assert authorization.to == self._PAY_TO
        assert authorization.value == 10000


class TestBuildExactEvmPaymentPayload:
    _SIG = "0x" + "ab" * 65

    def _auth(self) -> TransferAuthorization:
        return TransferAuthorization(
            from_="0x2222222222222222222222222222222222222222",
            to="0x1111111111111111111111111111111111111111",
            value=10000,
            valid_after=1,
            valid_before=99999,
            nonce=NORMATIVE_NONCE,
        )

    def test_wraps_with_x402_version_1_and_decimal_string_fields(self) -> None:
        p = build_exact_evm_payment_payload(
            network="base-sepolia",
            authorization=self._auth(),
            signature=self._SIG,
        ).to_dict()
        assert p["x402Version"] == 1
        assert p["scheme"] == "exact"
        assert p["network"] == "base-sepolia"
        assert p["payload"]["signature"] == self._SIG
        authz = p["payload"]["authorization"]
        assert authz["value"] == "10000"
        assert authz["validAfter"] == "1"
        assert authz["validBefore"] == "99999"
        assert authz["nonce"] == NORMATIVE_NONCE

    def test_rejects_a_malformed_signature(self) -> None:
        with pytest.raises(ValueError, match="signature"):
            build_exact_evm_payment_payload(
                network="base-sepolia",
                authorization=self._auth(),
                signature="not-hex",
            )

    def test_rejects_a_malformed_nonce(self) -> None:
        bad = TransferAuthorization(
            from_=self._auth().from_,
            to=self._auth().to,
            value=10000,
            valid_after=1,
            valid_before=99999,
            nonce="0xdeadbeef",
        )
        with pytest.raises(ValueError, match="nonce"):
            build_exact_evm_payment_payload(
                network="base-sepolia",
                authorization=bad,
                signature=self._SIG,
            )

    def test_rejects_an_unsupported_network(self) -> None:
        with pytest.raises(ValueError, match="network"):
            build_exact_evm_payment_payload(
                network="ethereum",
                authorization=self._auth(),
                signature=self._SIG,
            )
