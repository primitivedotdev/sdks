from __future__ import annotations

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct, encode_typed_data

from primitive import (
    NonceBinding,
    PayoutRegistrationMessageInput,
    PrivateKeySigner,
    TokenDomain,
    TransferAuthorization,
    build_payout_registration_message,
    derive_eip3009_nonce,
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
