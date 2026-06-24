from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import pytest

from primitive import (
    PayoutRegistrationMessageInput,
    PrivateKeySigner,
    X402Challenge,
    X402Client,
    X402Error,
    build_payout_registration_message,
)

TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
SIGNER = PrivateKeySigner(TEST_KEY)
ORG = "11111111-1111-4111-8111-111111111111"


def _expected_registration_signature(org: str, issued_at: str) -> str:
    """Reproduce the org-bound signature the client signs, for assertions."""
    message = build_payout_registration_message(
        PayoutRegistrationMessageInput(
            org=org,
            address=SIGNER.address,
            network="base-sepolia",
            issued_at=issued_at,
        )
    )
    return SIGNER.sign_message(message)


def _iso(delta_seconds: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=delta_seconds)).isoformat()


def _challenge_dict() -> dict[str, Any]:
    return {
        "id": "11111111-1111-4111-8111-111111111111",
        "network": "base-sepolia",
        "amount": "10000",
        "pay_to": "0x1111111111111111111111111111111111111111",
        "nonce_binding": {
            "interaction_id": "11111111-1111-4111-8111-111111111111@x402.primitive",
            "challenge_step_id": "f00dface-0000-0000-0000-0000000000aa",
            "challenge_nonce": (
                "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
            ),
        },
        "payment_requirements": {
            "scheme": "exact",
            "network": "base-sepolia",
            "maxAmountRequired": "10000",
            "payTo": "0x1111111111111111111111111111111111111111",
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "extra": {"name": "USDC", "version": "2"},
        },
        "expires_at": _iso(3600),
    }


def _challenge(**overrides: Any) -> X402Challenge:
    data = _challenge_dict()
    data.update(overrides)
    return X402Challenge.from_dict(data)


class _Recorder:
    def __init__(self, handler: Any) -> None:
        self.calls: list[httpx.Request] = []
        self._handler = handler

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        return self._handler(request)


def _client(handler: Any) -> tuple[X402Client, _Recorder]:
    recorder = _Recorder(handler)
    transport = httpx.MockTransport(recorder)
    http = httpx.Client(transport=transport)
    client = X402Client(api_key="k", base_url="https://api.example", http_client=http)
    return client, recorder


def _json_response(body: Any, status: int = 200, headers: dict | None = None):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json=body, headers=headers or {})

    return handler


class TestCharge:
    def test_posts_the_challenge_request_and_returns_the_challenge(self) -> None:
        client, rec = _client(
            _json_response({"success": True, "data": _challenge_dict()})
        )
        ch = client.charge(amount="10000", network="base-sepolia", description="demo")
        assert ch.id == "11111111-1111-4111-8111-111111111111"
        req = rec.calls[0]
        assert str(req.url) == "https://api.example/v1/x402/challenges"
        assert req.method == "POST"
        body = json.loads(req.content)
        assert body["amount"] == "10000"
        assert body["network"] == "base-sepolia"
        assert body["description"] == "demo"
        assert req.headers["authorization"] == "Bearer k"

    def test_sends_idempotency_key_header_when_given(self) -> None:
        client, rec = _client(
            _json_response({"success": True, "data": _challenge_dict()})
        )
        client.charge(amount="10000", idempotency_key="abc-123")
        assert rec.calls[0].headers["idempotency-key"] == "abc-123"

    def test_omits_idempotency_key_header_when_not_given(self) -> None:
        client, rec = _client(
            _json_response({"success": True, "data": _challenge_dict()})
        )
        client.charge(amount="10000")
        assert "idempotency-key" not in rec.calls[0].headers

    def test_rejects_an_unknown_option(self) -> None:
        client, _ = _client(_json_response({"success": True, "data": {}}))
        with pytest.raises(X402Error, match=r'unknown charge\(\) option "payer_x"'):
            client.charge(amount="10000", payer_x="x")  # type: ignore[call-arg]

    def test_requires_an_amount(self) -> None:
        client, _ = _client(_json_response({"success": True, "data": {}}))
        with pytest.raises(X402Error, match="positive integer string"):
            client.charge(amount="", network="base-sepolia")

    def test_rejects_a_non_integer_or_non_positive_amount(self) -> None:
        client, _ = _client(_json_response({"success": True, "data": {}}))
        for bad in ("1.5", "abc", "0"):
            with pytest.raises(X402Error, match="positive integer"):
                client.charge(amount=bad)

    def test_amount_usdc_converts_human_to_base_units(self) -> None:
        client, rec = _client(
            _json_response({"success": True, "data": _challenge_dict()})
        )
        client.charge(amount_usdc="0.01")
        assert json.loads(rec.calls[0].content)["amount"] == "10000"

    def test_amount_usdc_supports_whole_and_full_precision(self) -> None:
        cases = {
            "1": "1000000",
            "2.5": "2500000",
            "0.000001": "1",
            "123": "123000000",
        }
        for human, expected in cases.items():
            client, rec = _client(
                _json_response({"success": True, "data": _challenge_dict()})
            )
            client.charge(amount_usdc=human)
            assert json.loads(rec.calls[0].content)["amount"] == expected

    def test_rejects_both_amount_and_amount_usdc(self) -> None:
        client, rec = _client(_json_response({"success": True, "data": {}}))
        with pytest.raises(X402Error, match="exactly one of"):
            client.charge(amount="10000", amount_usdc="0.01")
        assert rec.calls == []

    def test_rejects_neither_amount_nor_amount_usdc(self) -> None:
        client, rec = _client(_json_response({"success": True, "data": {}}))
        with pytest.raises(X402Error, match="requires `amount`"):
            client.charge()
        assert rec.calls == []

    def test_rejects_a_malformed_or_over_precise_amount_usdc(self) -> None:
        client, _ = _client(_json_response({"success": True, "data": {}}))
        for bad in ("0", "0.0", "-1", "1.2.3", "abc", "0.0000001", ""):
            with pytest.raises(X402Error, match="at most 6 decimals"):
                client.charge(amount_usdc=bad)


class TestPay:
    def test_signs_the_authorization_locally_and_submits_it(self) -> None:
        client, rec = _client(
            _json_response(
                {
                    "success": True,
                    "data": {
                        "id": "11111111-1111-4111-8111-111111111111",
                        "status": "settled",
                        "settle_tx": "0x" + "a" * 64,
                    },
                }
            )
        )
        receipt = client.pay(_challenge(), signer=SIGNER)
        assert receipt.status == "settled"
        req = rec.calls[0]
        assert str(req.url) == (
            "https://api.example/v1/x402/challenges/"
            "11111111-1111-4111-8111-111111111111/pay"
        )
        body = json.loads(req.content)
        assert body["payment"]["x402Version"] == 1
        assert body["payment"]["scheme"] == "exact"
        authz = body["payment"]["payload"]["authorization"]
        assert authz["from"].lower() == SIGNER.address.lower()
        assert authz["to"] == "0x1111111111111111111111111111111111111111"
        assert authz["value"] == "10000"
        assert body["payment"]["payload"]["signature"].startswith("0x")

    def test_throws_x402error_with_status_on_non_2xx(self) -> None:
        client, _ = _client(
            _json_response(
                {"success": False, "error": {"message": "payment_declined"}}, 422
            )
        )
        with pytest.raises(X402Error, match="payment_declined") as exc:
            client.pay(_challenge(), signer=SIGNER)
        assert exc.value.status == 422

    def test_throws_clear_error_on_malformed_expires_at(self) -> None:
        client, rec = _client(_json_response({"success": True, "data": {}}))
        with pytest.raises(X402Error, match="invalid expires_at"):
            client.pay(_challenge(expires_at="not-a-date"), signer=SIGNER)
        assert rec.calls == []

    def test_rejects_a_missing_or_invalid_signer(self) -> None:
        client, _ = _client(_json_response({"success": True, "data": {}}))
        with pytest.raises(X402Error, match="requires a signer"):
            client.pay(_challenge(), signer=None)  # type: ignore[arg-type]

    def test_rejects_a_malformed_challenge_before_signing(self) -> None:
        client, rec = _client(_json_response({"success": True, "data": {}}))
        bad = _challenge_dict()
        bad["payment_requirements"] = None
        with pytest.raises(X402Error, match="payment_requirements"):
            client.pay(X402Challenge.from_dict(bad), signer=SIGNER)
        assert rec.calls == []

    def test_rejects_a_malformed_max_amount_required_before_signing(self) -> None:
        # A non-integer amount must surface as a named X402Error, not a raw
        # ValueError from int().
        client, rec = _client(_json_response({"success": True, "data": {}}))
        bad = _challenge_dict()
        bad["payment_requirements"]["maxAmountRequired"] = "not-a-number"
        with pytest.raises(X402Error, match="maxAmountRequired"):
            client.pay(X402Challenge.from_dict(bad), signer=SIGNER)
        assert rec.calls == []

    def test_rejects_an_already_expired_challenge_before_signing(self) -> None:
        client, rec = _client(_json_response({"success": True, "data": {}}))
        with pytest.raises(X402Error, match="already expired"):
            client.pay(_challenge(expires_at=_iso(-3600)), signer=SIGNER)
        # Expired only 2 minutes ago, inside the settlement margin: still caught.
        with pytest.raises(X402Error, match="already expired"):
            client.pay(_challenge(expires_at=_iso(-120)), signer=SIGNER)
        assert rec.calls == []

    def test_rejects_a_network_requirements_mismatch_before_signing(self) -> None:
        client, rec = _client(_json_response({"success": True, "data": {}}))
        bad = _challenge_dict()
        bad["payment_requirements"]["network"] = "base"
        with pytest.raises(X402Error, match="network mismatch"):
            client.pay(X402Challenge.from_dict(bad), signer=SIGNER)
        assert rec.calls == []


class TestHardening:
    def test_wraps_a_transport_error_as_x402error_status_0(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        client, _ = _client(handler)
        with pytest.raises(X402Error) as exc:
            client.charge(amount="10000")
        assert exc.value.status == 0

    def test_throws_on_a_non_json_2xx_body(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200, content=b"<html>nope</html>", headers={"content-type": "text/html"}
            )

        client, _ = _client(handler)
        with pytest.raises(X402Error, match="non-JSON response"):
            client.charge(amount="10000")

    def test_throws_when_the_envelope_is_missing(self) -> None:
        client, _ = _client(_json_response({"ok": True}))
        with pytest.raises(X402Error, match="missing success/data envelope"):
            client.charge(amount="10000")

    def test_surfaces_retry_after_on_a_rate_limit_error(self) -> None:
        client, _ = _client(
            _json_response(
                {"success": False, "error": {"message": "rate limited"}},
                429,
                {"retry-after": "12"},
            )
        )
        with pytest.raises(X402Error) as exc:
            client.charge(amount="10000")
        assert exc.value.status == 429
        assert exc.value.retry_after == "12"

    def test_rejects_a_missing_api_key_before_making_a_request(self) -> None:
        recorder = _Recorder(_json_response({"success": True, "data": {}}))
        http = httpx.Client(transport=httpx.MockTransport(recorder))
        client = X402Client(
            api_key="", base_url="https://api.example", http_client=http
        )
        with pytest.raises(X402Error, match="no API key"):
            client.charge(amount="10000")
        assert recorder.calls == []


class TestCompletenessMethods:
    def test_register_payout_address_signs_and_posts_the_proof(self) -> None:
        client, rec = _client(
            _json_response(
                {
                    "success": True,
                    "data": {
                        "id": "p1",
                        "address": SIGNER.address.lower(),
                        "network": "base-sepolia",
                        "label": None,
                        "is_default": True,
                        "verified_at": "2026-01-01T00:00:00.000Z",
                    },
                }
            )
        )
        res = client.register_payout_address(
            org=ORG,
            signer=SIGNER,
            network="base-sepolia",
            issued_at="2026-01-01T00:00:00.000Z",
        )
        assert res.is_default is True
        req = rec.calls[0]
        assert str(req.url) == "https://api.example/v1/x402/payout-addresses"
        assert req.method == "POST"
        body = json.loads(req.content)
        assert body["address"] == SIGNER.address
        assert body["network"] == "base-sepolia"
        assert body["issued_at"] == "2026-01-01T00:00:00.000Z"
        assert body["signature"].startswith("0x")

    def test_register_payout_address_auto_resolves_org_from_account(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/v1/account":
                return httpx.Response(200, json={"success": True, "data": {"id": ORG}})
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "id": "p1",
                        "address": SIGNER.address.lower(),
                        "network": "base-sepolia",
                        "label": None,
                        "is_default": True,
                        "verified_at": "2026-01-01T00:00:00.000Z",
                    },
                },
            )

        client, rec = _client(handler)
        res = client.register_payout_address(
            signer=SIGNER,
            issued_at="2026-01-01T00:00:00.000Z",
        )
        assert res.is_default is True
        account_req, register_req = rec.calls
        assert str(account_req.url) == "https://api.example/v1/account"
        assert account_req.method == "GET"
        assert str(register_req.url) == "https://api.example/v1/x402/payout-addresses"
        assert register_req.method == "POST"
        # The resolved org must be the one bound into the signed registration.
        signed = _expected_registration_signature(ORG, "2026-01-01T00:00:00.000Z")
        assert json.loads(register_req.content)["signature"] == signed

    def test_register_payout_address_errors_when_account_has_no_id(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/v1/account":
                return httpx.Response(200, json={"success": True, "data": {}})
            return httpx.Response(200, json={"success": True, "data": {}})

        client, rec = _client(handler)
        with pytest.raises(X402Error, match="could not resolve your organization id"):
            client.register_payout_address(signer=SIGNER)
        # It must not attempt the registration POST without an org.
        assert [c.url.path for c in rec.calls] == ["/v1/account"]

    def test_register_payout_address_requires_signer_with_sign_message(self) -> None:
        class NoMessageSigner:
            address = SIGNER.address

            def sign_typed_data(self, _td: Any) -> str:
                return "0x"

        client, _ = _client(_json_response({"success": True, "data": {}}))
        with pytest.raises(X402Error, match="sign_message"):
            client.register_payout_address(org=ORG, signer=NoMessageSigner())  # type: ignore[arg-type]

    def test_get_challenge_gets_the_challenge_by_id(self) -> None:
        client, rec = _client(
            _json_response({"success": True, "data": _challenge_dict()})
        )
        ch = client.get_challenge("11111111-1111-4111-8111-111111111111")
        assert ch.id == "11111111-1111-4111-8111-111111111111"
        req = rec.calls[0]
        assert str(req.url) == (
            "https://api.example/v1/x402/challenges/"
            "11111111-1111-4111-8111-111111111111"
        )
        assert req.method == "GET"

    def test_get_and_set_spend_policy(self) -> None:
        policy = {
            "paused": False,
            "max_per_payment": "1000000",
            "max_per_day": None,
            "allowlist": None,
        }
        client, rec = _client(_json_response({"success": True, "data": policy}))
        got = client.get_spend_policy()
        assert got.max_per_payment == "1000000"
        client.set_spend_policy({"paused": True})
        put_req = rec.calls[1]
        assert put_req.method == "PUT"
        assert json.loads(put_req.content) == {"paused": True}

    def test_list_payout_addresses_gets_the_directory(self) -> None:
        client, rec = _client(_json_response({"success": True, "data": []}))
        assert client.list_payout_addresses() == []
        req = rec.calls[0]
        assert str(req.url) == "https://api.example/v1/x402/payout-addresses"

    def test_list_declined_payments_gets_the_declines_log(self) -> None:
        declined = {
            "id": "d1",
            "challenge_id": "11111111-1111-4111-8111-111111111111",
            "counterparty_org": ORG,
            "network": "base-sepolia",
            "amount": "10000",
            "reason": "max_per_payment_exceeded",
            "declined_at": "2026-01-01T00:00:00.000Z",
        }
        client, rec = _client(_json_response({"success": True, "data": [declined]}))
        rows = client.list_declined_payments()
        assert len(rows) == 1
        assert rows[0].id == "d1"
        assert rows[0].reason == "max_per_payment_exceeded"
        assert rows[0].challenge_id == "11111111-1111-4111-8111-111111111111"
        req = rec.calls[0]
        assert str(req.url) == "https://api.example/v1/x402/declined-payments"
        assert req.method == "GET"

    def test_list_declined_payments_returns_empty_for_no_declines(self) -> None:
        client, rec = _client(_json_response({"success": True, "data": []}))
        assert client.list_declined_payments() == []
        assert str(rec.calls[0].url) == "https://api.example/v1/x402/declined-payments"
