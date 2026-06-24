"""x402 agent-to-agent payments.

:meth:`X402Client.charge` (payee) asks for a payment; :meth:`X402Client.pay`
(payer) signs and settles it with the customer's own key. The signing is local
and non-custodial; the key never leaves the caller. The server resolves the
real payee address, verifies every signed field against its own records, and
enforces the spend policy, so the SDK's job is just: derive the bound
authorization, sign, and submit.
"""

from __future__ import annotations

import math
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx
from dateutil.parser import isoparse

from .sign import (
    BuiltPaymentStep,
    NonceBinding,
    PayoutRegistrationMessageInput,
    TokenDomain,
    X402Signer,
    build_exact_evm_payment_payload,
    build_payment_step_envelope,
    build_payout_registration_message,
    compute_payment_validity_window,
    sign_interaction_payment,
)

_CHAIN_IDS: dict[str, int] = {
    "base-sepolia": 84532,
    "base": 8453,
}

_DEFAULT_BASE_URL = "https://api.primitive.dev"
_DEFAULT_TIMEOUT_SEC = 30.0

_ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_AMOUNT_RE = re.compile(r"^[1-9][0-9]{0,38}$")

_CHARGE_INPUT_KEYS = frozenset(
    {
        "amount",
        "amount_usdc",
        "network",
        "payer_org",
        "description",
        "resource",
        "expires_in",
        "idempotency_key",
    }
)

_USDC_AMOUNT_RE = re.compile(r"^[0-9]+(\.[0-9]+)?$")


def _usdc_to_base_units(human: str) -> str | None:
    """Convert a human USDC amount ("0.01") to base units ("10000").

    USDC has 6 decimals. The conversion uses integer math (no float) so there
    is no rounding. Returns ``None`` for a non-positive, malformed, or
    over-precise (>6 decimals) value.
    """
    trimmed = human.strip()
    if not _USDC_AMOUNT_RE.fullmatch(trimmed):
        return None
    whole, _, frac = trimmed.partition(".")
    if len(frac) > 6:
        return None
    base = int(whole) * 1_000_000 + int(frac.ljust(6, "0"))
    return str(base) if base > 0 else None


class X402Error(Exception):
    """A client- or server-side x402 failure.

    ``status`` is the HTTP status, or 0 for a client-side / transport error that
    never reached the server (on :meth:`X402Client.pay`, a status-0 error means
    the request may never have been sent).
    """

    def __init__(
        self,
        message: str,
        status: int,
        body: Any = None,
        *,
        retry_after: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.body = body
        self.retry_after = retry_after
        """The ``Retry-After`` response header, if the server sent one."""


@dataclass(frozen=True, slots=True)
class X402PaymentRequirements:
    scheme: str
    network: str
    max_amount_required: str
    pay_to: str
    asset: str
    extra: dict[str, str]


@dataclass(frozen=True, slots=True)
class X402Challenge:
    """A request for payment, as returned by ``charge()`` / the platform."""

    id: str
    network: str
    amount: str
    pay_to: str
    nonce_binding: dict[str, str]
    payment_requirements: X402PaymentRequirements
    expires_at: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> X402Challenge:
        pr = data.get("payment_requirements") or {}
        return cls(
            id=data.get("id", ""),
            network=data.get("network", ""),
            amount=data.get("amount", ""),
            pay_to=data.get("pay_to", ""),
            nonce_binding=data.get("nonce_binding") or {},
            payment_requirements=X402PaymentRequirements(
                scheme=pr.get("scheme", ""),
                network=pr.get("network", ""),
                max_amount_required=pr.get("maxAmountRequired", ""),
                pay_to=pr.get("payTo", ""),
                asset=pr.get("asset", ""),
                extra=pr.get("extra") or {},
            )
            if data.get("payment_requirements") is not None
            else None,  # type: ignore[arg-type]
            expires_at=data.get("expires_at", ""),
        )


def _payment_requirements_from_dict(
    pr: dict[str, Any] | None,
) -> X402PaymentRequirements | None:
    if pr is None:
        return None
    return X402PaymentRequirements(
        scheme=pr.get("scheme", ""),
        network=pr.get("network", ""),
        max_amount_required=pr.get("maxAmountRequired", ""),
        pay_to=pr.get("payTo", ""),
        asset=pr.get("asset", ""),
        extra=pr.get("extra") or {},
    )


@dataclass(frozen=True, slots=True)
class X402EmailChallengeDetails:
    """The challenge the payer signs and pays, inside an email-native response."""

    payment_requirements: X402PaymentRequirements
    nonce_binding: dict[str, str]
    expires_at: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> X402EmailChallengeDetails:
        return cls(
            payment_requirements=_payment_requirements_from_dict(
                data.get("payment_requirements")
            ),  # type: ignore[arg-type]
            nonce_binding=data.get("nonce_binding") or {},
            expires_at=data.get("expires_at", ""),
        )


@dataclass(frozen=True, slots=True)
class X402EmailChallenge:
    """The result of issuing an email-native challenge.

    ``interaction_id`` is the real email thread id (``uuid@domain``) the payment
    is bound to. Hand the whole object to the payer, who calls
    :meth:`X402Client.pay_email_challenge` with it to build the signed payment
    step.
    """

    interaction_id: str
    challenge_id: str
    challenge: X402EmailChallengeDetails

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> X402EmailChallenge:
        return cls(
            interaction_id=data.get("interaction_id", ""),
            challenge_id=data.get("challenge_id", ""),
            challenge=X402EmailChallengeDetails.from_dict(
                data.get("challenge") or {}
            ),
        )


@dataclass(frozen=True, slots=True)
class X402Receipt:
    id: str
    status: str
    settle_tx: str | None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> X402Receipt:
        return cls(
            id=data.get("id", ""),
            status=data.get("status", ""),
            settle_tx=data.get("settle_tx"),
        )


@dataclass(frozen=True, slots=True)
class X402PayoutAddress:
    """A registered payout address (read shape; mirrors the platform response)."""

    id: str
    address: str
    network: str
    label: str | None
    is_default: bool
    verified_at: str | None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> X402PayoutAddress:
        return cls(
            id=data.get("id", ""),
            address=data.get("address", ""),
            network=data.get("network", ""),
            label=data.get("label"),
            is_default=bool(data.get("is_default", False)),
            verified_at=data.get("verified_at"),
        )


@dataclass(frozen=True, slots=True)
class X402SpendPolicy:
    """The org's spend policy (read shape; also accepted by ``set_spend_policy``)."""

    paused: bool
    """Kill-switch: when true, all outbound payments are refused."""
    max_per_payment: str | None
    """Per-payment cap in token base units, or None for no cap."""
    max_per_day: str | None
    """Daily cap in token base units, or None for no cap."""
    allowlist: list[str] | None
    """Allowed payee org ids; None = any on-net payee, [] = deny all."""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> X402SpendPolicy:
        return cls(
            paused=bool(data.get("paused", False)),
            max_per_payment=data.get("max_per_payment"),
            max_per_day=data.get("max_per_day"),
            allowlist=data.get("allowlist"),
        )


@dataclass(frozen=True, slots=True)
class X402DeclinedPayment:
    """A payment the org's spend policy refused (read shape)."""

    id: str
    challenge_id: str | None
    counterparty_org: str | None
    network: str
    amount: str
    reason: str
    declined_at: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> X402DeclinedPayment:
        return cls(
            id=data.get("id", ""),
            challenge_id=data.get("challenge_id"),
            counterparty_org=data.get("counterparty_org"),
            network=data.get("network", ""),
            amount=data.get("amount", ""),
            reason=data.get("reason", ""),
            declined_at=data.get("declined_at", ""),
        )


def _validate_challenge(c: X402Challenge | None) -> None:
    """Assert a challenge is fully hydrated before signing.

    A missing field fails with a named :class:`X402Error` instead of an opaque
    crypto error mid-sign.
    """

    def bad(field: str) -> None:
        raise X402Error(f"challenge is missing or malformed: {field}", 0)

    if not c or not isinstance(c, X402Challenge):
        bad("challenge")
    assert c is not None
    if not c.id:
        bad("id")
    if not c.network:
        bad("network")
    if not c.expires_at:
        bad("expires_at")
    nb = c.nonce_binding
    if (
        not nb
        or not nb.get("interaction_id")
        or not nb.get("challenge_step_id")
        or not nb.get("challenge_nonce")
    ):
        bad("nonce_binding")
    _validate_payment_requirements(c.payment_requirements, bad)


def _validate_payment_requirements(
    pr: X402PaymentRequirements | None,
    bad: Any,
) -> None:
    """Validate the x402 PaymentRequirements shared by both challenge shapes."""
    if not pr:
        bad("payment_requirements")
    assert pr is not None
    # Require a positive integer base-units string so the later int()
    # conversion cannot raise a raw ValueError on a malformed value.
    if not _AMOUNT_RE.fullmatch(pr.max_amount_required or ""):
        bad(
            "payment_requirements.maxAmountRequired (expected a positive "
            "integer string in token base units)"
        )
    if not _ADDRESS_RE.fullmatch(pr.pay_to or ""):
        bad("payment_requirements.payTo (expected a 0x address)")
    if not _ADDRESS_RE.fullmatch(pr.asset or ""):
        bad("payment_requirements.asset (expected a 0x address)")
    if not pr.extra or not pr.extra.get("name") or not pr.extra.get("version"):
        bad("payment_requirements.extra (name/version)")


def _validate_email_challenge(c: X402EmailChallenge | None) -> None:
    """Assert an email-native challenge is fully hydrated before signing."""

    def bad(field: str) -> None:
        raise X402Error(
            f"email challenge is missing or malformed: {field}", 0
        )

    if not c or not isinstance(c, X402EmailChallenge):
        bad("email challenge")
    assert c is not None
    if not c.interaction_id:
        bad("interaction_id")
    ch = c.challenge
    if not ch:
        bad("challenge")
    if not ch.expires_at:
        bad("challenge.expires_at")
    nb = ch.nonce_binding
    if (
        not nb
        or not nb.get("interaction_id")
        or not nb.get("challenge_step_id")
        or not nb.get("challenge_nonce")
    ):
        bad("challenge.nonce_binding")
    # The envelope's interaction_id must agree with the binding's, or the
    # platform would re-derive a nonce that doesn't match what we signed.
    if nb.get("interaction_id") != c.interaction_id:
        bad(
            "interaction_id (mismatch with "
            "challenge.nonce_binding.interaction_id)"
        )
    _validate_payment_requirements(ch.payment_requirements, bad)


class X402Client:
    """A high-level client for the x402 payment endpoints.

    Mirrors the Node SDK's ``X402Client``. All endpoints return a
    ``{success, data}`` envelope; the returned objects are the unwrapped
    ``data``.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._api_key = (
            api_key if api_key is not None else os.environ.get("PRIMITIVE_API_KEY", "")
        )
        self._base_url = (base_url or _DEFAULT_BASE_URL).rstrip("/")
        self._timeout = timeout if timeout is not None else _DEFAULT_TIMEOUT_SEC
        self._http = http_client

    def _request(
        self,
        method: str,
        path: str,
        body: Any = None,
        *,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        if not self._api_key:
            raise X402Error(
                "no API key configured; set PRIMITIVE_API_KEY or pass api_key "
                "to the client",
                0,
            )

        headers = {
            "authorization": f"Bearer {self._api_key}",
            "content-type": "application/json",
        }
        if extra_headers:
            headers.update(extra_headers)
        url = f"{self._base_url}{path}"

        try:
            if self._http is not None:
                response = self._http.request(
                    method,
                    url,
                    headers=headers,
                    json=body,
                    timeout=self._timeout,
                )
            else:
                response = httpx.request(
                    method,
                    url,
                    headers=headers,
                    json=body,
                    timeout=self._timeout,
                )
        except httpx.TimeoutException as cause:
            raise X402Error(
                f"request to {path} timed out after {self._timeout}s",
                0,
            ) from cause
        except httpx.HTTPError as cause:
            # A failed request (DNS, connection refused, TLS) must not escape as
            # a raw httpx error: callers rely on isinstance(err, X402Error), and
            # on pay() a status-0 error signals an indeterminate request.
            raise X402Error(
                f"request to {path} failed: {cause}",
                0,
            ) from cause

        retry_after = response.headers.get("retry-after")
        text = response.text or ""
        json_body: dict[str, Any] | None = None
        if text:
            try:
                json_body = response.json()
            except (ValueError, httpx.DecodingError) as cause:
                raise X402Error(
                    f"non-JSON response ({response.status_code}) from {path}: "
                    f"{text[:200]}",
                    response.status_code,
                    text[:500],
                    retry_after=retry_after,
                ) from cause

        success = json_body.get("success") if isinstance(json_body, dict) else None
        if not response.is_success or success is False:
            message = None
            if isinstance(json_body, dict):
                error = json_body.get("error")
                if isinstance(error, dict):
                    message = error.get("message")
            raise X402Error(
                message or f"request failed with {response.status_code}",
                response.status_code,
                json_body if json_body is not None else text[:500],
                retry_after=retry_after,
            )
        if (
            not isinstance(json_body, dict)
            or json_body.get("success") is not True
            or json_body.get("data") is None
        ):
            raise X402Error(
                f"unexpected response shape ({response.status_code}) from "
                f"{path}: missing success/data envelope",
                response.status_code,
                json_body if json_body is not None else text[:500],
                retry_after=retry_after,
            )
        return json_body["data"]

    def charge(
        self,
        *,
        amount: str | None = None,
        amount_usdc: str | None = None,
        network: str | None = None,
        payer_org: str | None = None,
        description: str | None = None,
        resource: str | None = None,
        expires_in: int | None = None,
        idempotency_key: str | None = None,
        **unknown: Any,
    ) -> X402Challenge:
        """Request a payment (payee side).

        Provide exactly one of ``amount`` (token base units, e.g. ``"10000"``)
        or ``amount_usdc`` (human USDC, e.g. ``"0.01"``). Returns the challenge
        to hand to the payer.

        Pass ``idempotency_key`` to make the request idempotent: retrying
        ``charge()`` with the same key returns the original challenge instead of
        creating a duplicate. It is sent as an ``Idempotency-Key`` header.
        """
        if unknown:
            key = next(iter(unknown))
            raise X402Error(
                f'unknown charge() option "{key}"; expected one of: '
                f"{', '.join(sorted(_CHARGE_INPUT_KEYS))}",
                0,
            )
        if amount is not None and amount_usdc is not None:
            raise X402Error(
                "charge() takes exactly one of `amount` (base units) or "
                "`amount_usdc` (human USDC), not both",
                0,
            )
        resolved = (
            _usdc_to_base_units(amount_usdc) if amount_usdc is not None else amount
        )
        if not resolved or not _AMOUNT_RE.fullmatch(resolved):
            raise X402Error(
                "charge() requires `amount` as a positive integer string in "
                'token base units (e.g. "10000"), or `amount_usdc` as a '
                "positive USDC amount with at most 6 decimals (e.g. \"0.01\")",
                0,
            )
        amount = resolved
        body: dict[str, Any] = {
            "amount": amount,
            "network": network or "base-sepolia",
        }
        if payer_org:
            body["payer_org"] = payer_org
        if description:
            body["description"] = description
        if resource:
            body["resource"] = resource
        if expires_in is not None:
            body["expires_in"] = expires_in
        extra_headers = (
            {"idempotency-key": idempotency_key} if idempotency_key else None
        )
        data = self._request(
            "POST", "/v1/x402/challenges", body, extra_headers=extra_headers
        )
        return X402Challenge.from_dict(data)

    def create_email_challenge(
        self,
        *,
        from_: str,
        to: str,
        amount: str | None = None,
        amount_usdc: str | None = None,
        network: str | None = None,
        description: str | None = None,
        resource: str | None = None,
        expires_in: int | None = None,
        idempotency_key: str | None = None,
    ) -> X402EmailChallenge:
        """Issue a payment challenge over an email thread (payee side).

        Sends the challenge as an email from ``from_`` to ``to`` and binds the
        payment to that thread. Returns the challenge (including the real
        ``interaction_id``); deliver it to the payer, who calls
        :meth:`pay_email_challenge` to build the signed payment step.

        Provide exactly one of ``amount`` (base units) or ``amount_usdc`` (human
        USDC). Pass ``idempotency_key`` to make the request idempotent: a retry
        with the same key returns the original challenge without sending a
        second email.
        """
        if not from_:
            raise X402Error("create_email_challenge() requires `from_`", 0)
        if not to:
            raise X402Error("create_email_challenge() requires `to`", 0)
        if amount is not None and amount_usdc is not None:
            raise X402Error(
                "create_email_challenge() takes exactly one of `amount` (base "
                "units) or `amount_usdc` (human USDC), not both",
                0,
            )
        resolved = (
            _usdc_to_base_units(amount_usdc)
            if amount_usdc is not None
            else amount
        )
        if not resolved or not _AMOUNT_RE.fullmatch(resolved):
            raise X402Error(
                "create_email_challenge() requires `amount` as a positive "
                'integer string in token base units (e.g. "10000"), or '
                "`amount_usdc` as a positive USDC amount with at most 6 "
                'decimals (e.g. "0.01")',
                0,
            )
        body: dict[str, Any] = {
            "from": from_,
            "to": to,
            "amount": resolved,
            "network": network or "base-sepolia",
        }
        if description:
            body["description"] = description
        if resource:
            body["resource"] = resource
        if expires_in is not None:
            body["expires_in"] = expires_in
        extra_headers = (
            {"idempotency-key": idempotency_key} if idempotency_key else None
        )
        data = self._request(
            "POST",
            "/v1/x402/email-challenges",
            body,
            extra_headers=extra_headers,
        )
        return X402EmailChallenge.from_dict(data)

    def pay_email_challenge(
        self, challenge: X402EmailChallenge, *, signer: X402Signer
    ) -> BuiltPaymentStep:
        """Build the signed payment step for an email-native challenge (payer).

        Given a received :class:`X402EmailChallenge` and the caller's signer,
        this derives the interaction-bound authorization, signs it locally, and
        returns the signed ``interaction.json`` payment-step envelope plus its
        canonical JSON bytes. It does NOT send anything.

        The caller sends ``result.json`` back as an ``interaction.json``
        attachment on a reply to the challenge email; the platform reads the
        envelope from those exact bytes, re-derives the bound nonce, and
        settles.
        """
        if (
            signer is None
            or not getattr(signer, "address", None)
            or not callable(getattr(signer, "sign_typed_data", None))
        ):
            raise X402Error(
                "pay_email_challenge() requires a signer with { address, "
                "sign_typed_data } (e.g. a PrivateKeySigner)",
                0,
            )
        _validate_email_challenge(challenge)
        details = challenge.challenge
        pr = details.payment_requirements
        network = pr.network
        chain_id = _CHAIN_IDS.get(network)
        if chain_id is None:
            raise X402Error(f"unsupported network: {network}", 0)
        if pr.scheme != "exact":
            raise X402Error(f"unsupported payment scheme: {pr.scheme}", 0)

        now_sec = math.floor(datetime.now(timezone.utc).timestamp())
        try:
            expires_at_sec = math.floor(
                isoparse(details.expires_at).timestamp()
            )
        except (ValueError, OverflowError) as cause:
            raise X402Error(
                f"challenge has an invalid expires_at: {details.expires_at}",
                0,
            ) from cause
        if expires_at_sec <= now_sec:
            raise X402Error(
                f"challenge has already expired (expires_at "
                f"{details.expires_at}); not signing",
                0,
            )
        try:
            valid_after, valid_before = compute_payment_validity_window(
                challenge_expires_at_sec=expires_at_sec,
                now_sec=now_sec,
            )
        except ValueError as cause:
            raise X402Error(str(cause), 0) from cause

        auth, signature = sign_interaction_payment(
            sign=signer.sign_typed_data,
            payer=signer.address,
            domain=TokenDomain(
                name=pr.extra["name"],
                version=pr.extra["version"],
                chain_id=chain_id,
                verifying_contract=pr.asset,
            ),
            pay_to=pr.pay_to,
            amount=int(pr.max_amount_required),
            nonce_binding=NonceBinding(
                interaction_id=details.nonce_binding["interaction_id"],
                challenge_step_id=details.nonce_binding["challenge_step_id"],
                challenge_nonce=details.nonce_binding["challenge_nonce"],
            ),
            valid_after=valid_after,
            valid_before=valid_before,
        )

        payment = build_exact_evm_payment_payload(
            network=network,
            authorization=auth,
            signature=signature,
        )
        # A fresh UUID identifies the payment step; prev_step_id binds it to the
        # challenge step so the platform threads the interaction correctly.
        return build_payment_step_envelope(
            interaction_id=challenge.interaction_id,
            step_id=str(uuid.uuid4()),
            prev_step_id=details.nonce_binding["challenge_step_id"],
            payment=payment,
        )

    def pay(self, challenge: X402Challenge, *, signer: X402Signer) -> X402Receipt:
        """Pay a challenge (payer side).

        Derives the interaction-bound authorization, signs it locally with the
        caller's key, and submits it for settlement.
        """
        if (
            signer is None
            or not getattr(signer, "address", None)
            or not callable(getattr(signer, "sign_typed_data", None))
        ):
            raise X402Error(
                "pay() requires a signer with { address, sign_typed_data } "
                "(e.g. a PrivateKeySigner)",
                0,
            )
        _validate_challenge(challenge)
        chain_id = _CHAIN_IDS.get(challenge.network)
        if chain_id is None:
            raise X402Error(f"unsupported network: {challenge.network}", 0)
        pr = challenge.payment_requirements
        # chainId is derived from challenge.network but the token domain
        # (contract/name/version) comes from payment_requirements; cross-check
        # they agree so we never sign a chainId mismatched to the asset.
        if pr.network != challenge.network:
            raise X402Error(
                f"challenge network mismatch: {challenge.network} vs "
                f"payment_requirements {pr.network}",
                0,
            )
        if pr.scheme != "exact":
            raise X402Error(f"unsupported payment scheme: {pr.scheme}", 0)

        now_sec = math.floor(datetime.now(timezone.utc).timestamp())
        try:
            expires_at_sec = math.floor(isoparse(challenge.expires_at).timestamp())
        except (ValueError, OverflowError) as cause:
            raise X402Error(
                f"challenge has an invalid expires_at: {challenge.expires_at}",
                0,
            ) from cause
        # Refuse a challenge already past its expires_at. Check expires_at
        # itself, NOT validBefore (which carries the settlement margin), so a
        # challenge that expired within the last settlement margin is still
        # caught. This also rules out validAfter >= validBefore inversion.
        if expires_at_sec <= now_sec:
            raise X402Error(
                f"challenge has already expired (expires_at "
                f"{challenge.expires_at}); not signing",
                0,
            )
        try:
            valid_after, valid_before = compute_payment_validity_window(
                challenge_expires_at_sec=expires_at_sec,
                now_sec=now_sec,
            )
        except ValueError as cause:
            raise X402Error(str(cause), 0) from cause

        auth, signature = sign_interaction_payment(
            sign=signer.sign_typed_data,
            payer=signer.address,
            domain=TokenDomain(
                name=pr.extra["name"],
                version=pr.extra["version"],
                chain_id=chain_id,
                verifying_contract=pr.asset,
            ),
            pay_to=pr.pay_to,
            amount=int(pr.max_amount_required),
            nonce_binding=NonceBinding(
                interaction_id=challenge.nonce_binding["interaction_id"],
                challenge_step_id=challenge.nonce_binding["challenge_step_id"],
                challenge_nonce=challenge.nonce_binding["challenge_nonce"],
            ),
            valid_after=valid_after,
            valid_before=valid_before,
        )

        data = self._request(
            "POST",
            f"/v1/x402/challenges/{_quote(challenge.id)}/pay",
            {
                "payment": build_exact_evm_payment_payload(
                    network=challenge.network,
                    authorization=auth,
                    signature=signature,
                ).to_dict()
            },
        )
        return X402Receipt.from_dict(data)

    def get_challenge(self, id: str) -> X402Challenge:
        """Fetch a challenge by id (scoped to the challenger org that created it)."""
        if not id:
            raise X402Error("get_challenge() requires a challenge id", 0)
        data = self._request("GET", f"/v1/x402/challenges/{_quote(id)}")
        return X402Challenge.from_dict(data)

    def _resolve_org_id(self) -> str:
        """Resolve the caller's own organization id from the account endpoint."""
        account = self._request("GET", "/v1/account")
        org_id = account.get("id") if isinstance(account, dict) else None
        if not org_id:
            raise X402Error(
                "could not resolve your organization id from /v1/account; pass "
                "`org` explicitly",
                0,
            )
        return org_id

    def register_payout_address(
        self,
        *,
        org: str | None = None,
        signer: X402Signer,
        network: str | None = None,
        issued_at: str | None = None,
        label: str | None = None,
    ) -> X402PayoutAddress:
        """Register a payout address for your org (payee side).

        The signer proves control of its own address with an org-bound
        ``personal_sign``; the proven address becomes (or updates to) the
        default payout destination for the network. ``charge()`` resolves its
        ``pay_to`` from this directory, so a payee must register before
        requesting payments.

        ``org`` is optional: when omitted it is resolved from your authenticated
        account, so most callers never need to supply it.
        """
        if not callable(getattr(signer, "sign_message", None)):
            raise X402Error(
                "register_payout_address() requires a signer with sign_message "
                "(e.g. a PrivateKeySigner)",
                0,
            )
        org = org or self._resolve_org_id()
        network = network or "base-sepolia"
        issued_at = issued_at or _now_iso()
        address = signer.address
        message = build_payout_registration_message(
            PayoutRegistrationMessageInput(
                org=org,
                address=address,
                network=network,
                issued_at=issued_at,
            )
        )
        signature = signer.sign_message(message)
        body: dict[str, Any] = {
            "address": address,
            "network": network,
            "signature": signature,
            "issued_at": issued_at,
        }
        if label is not None:
            body["label"] = label
        data = self._request("POST", "/v1/x402/payout-addresses", body)
        return X402PayoutAddress.from_dict(data)

    def list_payout_addresses(self) -> list[X402PayoutAddress]:
        """List your org's registered payout addresses."""
        data = self._request("GET", "/v1/x402/payout-addresses")
        return [X402PayoutAddress.from_dict(item) for item in data]

    def list_declined_payments(self) -> list[X402DeclinedPayment]:
        """List the most recent payments your org's spend policy declined.

        Returned newest first. Use this to see why an outbound payment was
        refused.
        """
        data = self._request("GET", "/v1/x402/declined-payments")
        return [X402DeclinedPayment.from_dict(item) for item in data]

    def get_spend_policy(self) -> X402SpendPolicy:
        """Read your org's spend policy (kill-switch + caps + allowlist)."""
        data = self._request("GET", "/v1/x402/spend-policy")
        return X402SpendPolicy.from_dict(data)

    def set_spend_policy(self, update: dict[str, Any]) -> X402SpendPolicy:
        """Update your org's spend policy.

        The endpoint is a PUT, but the server applies it as a merge: only the
        fields you include are changed and omitted fields keep their current
        value, so a partial update can't silently reset the kill-switch. Pass
        ``None`` to clear a cap.
        """
        data = self._request("PUT", "/v1/x402/spend-policy", update)
        return X402SpendPolicy.from_dict(data)


def create_x402_client(
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    timeout: float | None = None,
    http_client: httpx.Client | None = None,
) -> X402Client:
    return X402Client(
        api_key=api_key,
        base_url=base_url,
        timeout=timeout,
        http_client=http_client,
    )


def _now_iso() -> str:
    # ISO-8601 in UTC with a trailing Z, matching the Node client's
    # new Date().toISOString().
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _quote(value: str) -> str:
    return quote(value, safe="")
