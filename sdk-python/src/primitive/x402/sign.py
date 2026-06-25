"""x402 client-side signing.

The payer signs an EIP-3009 ``transferWithAuthorization`` over the customer's
own key; the key never leaves them. This module derives the interaction-bound
nonce and assembles the EIP-712 typed data and the wire payload. The byte
layout here MUST match the platform verifier exactly; a normative test vector
(see ``tests/test_x402_sign.py``) locks the nonce derivation to the same value
the server recomputes.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils.crypto import keccak

# A challenge nonce is 32 bytes rendered as 64 lowercase hex chars, no 0x.
_CHALLENGE_NONCE_RE = re.compile(r"^[0-9a-f]{64}$")

# Single-byte domain separator between the variable-length string fields.
_FIELD_SEPARATOR = b"\x00"


@dataclass(frozen=True, slots=True)
class NonceBinding:
    """The fields that bind an EIP-3009 nonce to one interaction step."""

    interaction_id: str
    """The interaction id, including its ``@domain``. Lowercased before hashing."""
    challenge_step_id: str
    """The challenge step id (a UUID). Lowercased before hashing."""
    challenge_nonce: str
    """The challenger's per-challenge random nonce: 64 lowercase hex chars."""


def derive_eip3009_nonce(binding: NonceBinding) -> str:
    """Derive the EIP-3009 nonce bound to a specific interaction step.

    ::

        keccak256( utf8(lower(interaction_id)) || 0x00
                 || utf8(lower(challenge_step_id)) || 0x00
                 || hexdecode(challenge_nonce) )

    The ``0x00`` separators pin the field boundaries (undelimited concatenation
    of variable-length strings is collision-ambiguous), and the challenge nonce
    is decoded to its 32 raw bytes before hashing. The platform recomputes this
    and rejects a mismatch.

    Returns the 32-byte digest as a ``0x``-prefixed lowercase hex string.
    """
    if not _CHALLENGE_NONCE_RE.fullmatch(binding.challenge_nonce):
        raise ValueError(
            "challenge_nonce must be exactly 64 lowercase hex chars (32 bytes), "
            "no 0x prefix"
        )
    data = (
        binding.interaction_id.lower().encode("utf-8")
        + _FIELD_SEPARATOR
        + binding.challenge_step_id.lower().encode("utf-8")
        + _FIELD_SEPARATOR
        + bytes.fromhex(binding.challenge_nonce)
    )
    return "0x" + keccak(data).hex()


# The EIP-3009 ``TransferWithAuthorization`` EIP-712 type. The field order and
# types are part of the on-chain contract and MUST NOT change.
TRANSFER_WITH_AUTHORIZATION_TYPES: dict[str, list[dict[str, str]]] = {
    "TransferWithAuthorization": [
        {"name": "from", "type": "address"},
        {"name": "to", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "validAfter", "type": "uint256"},
        {"name": "validBefore", "type": "uint256"},
        {"name": "nonce", "type": "bytes32"},
    ],
}


@dataclass(frozen=True, slots=True)
class TokenDomain:
    """The token's EIP-712 domain.

    ``name``/``version`` MUST be the actual token's domain params (Base mainnet
    USDC reports ``name="USD Coin"``, Base Sepolia ``"USDC"``; both
    ``version="2"``); they come from the challenge's payment requirements
    ``extra``. A wrong name/version produces a signature the verifier rejects.
    """

    name: str
    version: str
    chain_id: int
    verifying_contract: str


@dataclass(frozen=True, slots=True)
class TransferAuthorization:
    """A signed (or to-be-signed) EIP-3009 transfer authorization."""

    from_: str
    to: str
    value: int
    """Token base units (USDC has 6 decimals), as an int."""
    valid_after: int
    valid_before: int
    nonce: str
    """The interaction-bound nonce as a ``0x``-prefixed 32-byte hex string."""


def transfer_with_authorization_typed_data(
    domain: TokenDomain,
    auth: TransferAuthorization,
) -> dict[str, Any]:
    """Build the EIP-712 typed-data document for an EIP-3009 transfer.

    The shape matches ``eth_account``'s ``full_message`` form: ``domain``,
    ``types``, ``primaryType`` and ``message``. ``nonce`` is passed as raw
    bytes so it is encoded as ``bytes32`` rather than re-hashed as a string.
    """
    return {
        "domain": {
            "name": domain.name,
            "version": domain.version,
            "chainId": domain.chain_id,
            "verifyingContract": domain.verifying_contract,
        },
        "types": TRANSFER_WITH_AUTHORIZATION_TYPES,
        "primaryType": "TransferWithAuthorization",
        "message": {
            "from": auth.from_,
            "to": auth.to,
            "value": auth.value,
            "validAfter": auth.valid_after,
            "validBefore": auth.valid_before,
            "nonce": _hex_to_bytes(auth.nonce),
        },
    }


@dataclass(frozen=True, slots=True)
class PayoutRegistrationMessageInput:
    """The fields bound into the payout-address ownership message."""

    org: str
    """The org id the address is being authorized for. Bound into the signature."""
    address: str
    """The payout address (the signer's own address). Lowercased in the message."""
    network: str
    issued_at: str
    """ISO-8601 timestamp; the server enforces a freshness window against replay."""


def build_payout_registration_message(input: PayoutRegistrationMessageInput) -> str:
    """Build the payout-address ownership message.

    This MUST be byte-identical to the platform's
    ``buildPayoutRegistrationMessage``, or registration fails the ownership
    proof. The org id is in the signed bytes, so a captured signature can never
    register the address under a different org.
    """
    return "\n".join(
        [
            "Primitive x402 payout address authorization",
            "",
            "I authorize this address as a payout destination for my "
            "Primitive organization.",
            "",
            f"org: {input.org}",
            f"address: {input.address.lower()}",
            f"network: {input.network}",
            f"issued: {input.issued_at}",
        ]
    )


@runtime_checkable
class X402Signer(Protocol):
    """A customer-held signer.

    ``PrivateKeySigner`` satisfies this directly; any key source (hardware
    wallet, injected provider) can be adapted. The key never leaves the caller.
    """

    @property
    def address(self) -> str: ...

    def sign_typed_data(self, typed_data: dict[str, Any]) -> str:
        """Sign an EIP-712 typed-data document; returns a ``0x`` hex signature."""
        ...

    def sign_message(self, message: str) -> str:
        """``personal_sign`` over a UTF-8 string.

        Only needed for :meth:`X402Client.register_payout_address` (the
        ownership proof). Returns a ``0x`` hex signature.
        """
        ...


class PrivateKeySigner:
    """An :class:`X402Signer` backed by a raw secp256k1 private key.

    The key stays in process and is used to produce both the EIP-712
    typed-data signature (for ``pay``) and the EIP-191 ``personal_sign``
    message signature (for ``register_payout_address``).
    """

    def __init__(self, private_key: str | bytes) -> None:
        self._account = Account.from_key(private_key)

    @property
    def address(self) -> str:
        return self._account.address

    def sign_typed_data(self, typed_data: dict[str, Any]) -> str:
        signed = Account.sign_typed_data(self._account.key, full_message=typed_data)
        return _to_hex(signed.signature)

    def sign_message(self, message: str) -> str:
        signed = Account.sign_message(encode_defunct(text=message), self._account.key)
        return _to_hex(signed.signature)


@dataclass(frozen=True, slots=True)
class X402PaymentPayload:
    """The x402 wire payload (validated server-side against the x402 schema)."""

    x402_version: int
    scheme: str
    network: str
    payload: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "x402Version": self.x402_version,
            "scheme": self.scheme,
            "network": self.network,
            "payload": self.payload,
        }


def to_payment_payload(
    network: str,
    auth: TransferAuthorization,
    signature: str,
) -> X402PaymentPayload:
    """Assemble the wire payload from a signed authorization."""
    return X402PaymentPayload(
        x402_version=1,
        scheme="exact",
        network=network,
        payload={
            "signature": signature,
            "authorization": {
                "from": auth.from_,
                "to": auth.to,
                "value": str(auth.value),
                "validAfter": str(auth.valid_after),
                "validBefore": str(auth.valid_before),
                "nonce": auth.nonce,
            },
        },
    )


# The protocol the email-native payment interaction runs (``x402.payment/1``).
# The payer's reply carries the ``payment`` step of this protocol.
X402_INTERACTION_PROTOCOL = "x402.payment"
X402_INTERACTION_PROTOCOL_VERSION = 1

# A UUID (used for the interaction id's local part and the step ids).
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
# An interaction id is ``uuid@domain``.
_WIRE_ID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@[^\s@]+$",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class BuiltPaymentStep:
    """A built, signed payment-step envelope plus its canonical JSON bytes.

    The caller attaches ``json`` as the ``interaction.json`` part of the reply
    email; the platform reads ``envelope`` back from those exact bytes.
    """

    envelope: dict[str, Any]
    json: str
    """The canonical interaction.json body (what to attach to the reply)."""


def build_payment_step_envelope(
    *,
    interaction_id: str,
    step_id: str,
    prev_step_id: str,
    payment: X402PaymentPayload,
    expires_at: str | None = None,
) -> BuiltPaymentStep:
    """Build the section-2.3 interaction.json envelope for a ``payment`` step.

    Pure: no I/O. ``payment`` is the signed exact-EVM payload (from
    :func:`build_exact_evm_payment_payload`); ``prev_step_id`` is the challenge
    step id this payment answers, and ``step_id`` is a fresh UUID for the payment
    step. Returns the envelope and its canonical JSON, so the bytes the platform
    reads back are exactly the ones produced here.
    """
    if not _WIRE_ID_RE.fullmatch(interaction_id):
        raise ValueError(
            "build_payment_step_envelope: interaction_id must be uuid@domain"
        )
    if not _UUID_RE.fullmatch(step_id):
        raise ValueError("build_payment_step_envelope: step_id must be a uuid")
    if not _UUID_RE.fullmatch(prev_step_id):
        raise ValueError(
            "build_payment_step_envelope: prev_step_id must be a uuid"
        )
    envelope: dict[str, Any] = {
        "interaction_version": 1,
        "interaction_id": interaction_id,
        "protocol": X402_INTERACTION_PROTOCOL,
        "protocol_version": X402_INTERACTION_PROTOCOL_VERSION,
        "step": "payment",
        "step_id": step_id,
        "prev_step_id": prev_step_id,
        "expires_at": expires_at,
        "payload": {"payment": payment.to_dict()},
    }
    return BuiltPaymentStep(
        envelope=envelope, json=json.dumps(envelope, separators=(",", ":"))
    )


# Absolute ceiling on the total signed window (valid_before - valid_after). A
# signed EIP-3009 authorization stays settleable on-chain until valid_before
# regardless of the interaction state, so an unbounded window is a standing
# "funds committed" risk. The real window is minutes; this 24h cap is the hard
# safety ceiling, enforced so a caller-supplied window cannot bypass it.
DEFAULT_MAX_WINDOW_SEC = 24 * 60 * 60

# Minimum headroom between now and valid_before. The platform rejects a payment
# whose authorization is about to expire (it needs SMTP + DKIM + verify + settle
# latency to clear), so a valid_before less than this far in the future is a
# guaranteed-to-fail signature. The default window is minutes; this 60s floor is
# the absolute minimum the band tolerates.
DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC = 60


def compute_payment_validity_window(
    *,
    challenge_expires_at_sec: int,
    now_sec: int,
    settlement_margin_sec: int = 5 * 60,
    clock_skew_sec: int = 5 * 60,
    max_window_sec: int = DEFAULT_MAX_WINDOW_SEC,
    min_headroom_sec: int = DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC,
    valid_before_sec: int | None = None,
    valid_after_sec: int | None = None,
    clamp: bool = True,
) -> tuple[int, int]:
    """Compute the EIP-3009 ``(valid_after, valid_before)`` window for a payment.

    ``valid_before`` governs on-chain validity, so it MUST stay far enough in the
    future to settle (>= ``min_headroom_sec``) yet not so far that the total
    window exceeds the ``max_window_sec`` cap; ``valid_after`` is set generously
    in the past for clock skew.

    Both ends of that band are payer landmines: a too-tight ``valid_before``
    (low headroom, e.g. a near-expired challenge) is rejected for being about to
    expire, and a too-wide window (far-future expiry) is rejected as
    "authorization window too wide". By default this clamps the computed window
    into the band so a caller who does not override always gets a signable
    window.

    If the caller passes an explicit ``valid_before_sec`` or ``valid_after_sec``,
    that is an intent to pin the bound: when it falls outside the band this
    raises a :class:`ValueError` naming which bound was violated (rather than
    silently signing a doomed authorization), unless ``clamp`` is left enabled,
    in which case the pinned value is clamped into the band like the computed
    one. Returns ``(valid_after, valid_before)``.
    """
    if max_window_sec < min_headroom_sec:
        raise ValueError(
            f"invalid validity window config: max_window_sec ({max_window_sec}) "
            f"is smaller than min_headroom_sec ({min_headroom_sec})"
        )

    # valid_after is pinned when overridden, else derived for clock skew.
    valid_after = (
        valid_after_sec if valid_after_sec is not None else now_sec - clock_skew_sec
    )
    # The raw valid_before before banding: the pinned value or expiry + margin.
    raw_valid_before = (
        valid_before_sec
        if valid_before_sec is not None
        else challenge_expires_at_sec + settlement_margin_sec
    )

    # The accepted band for valid_before: at least min_headroom past now (so the
    # signature can settle), and at most valid_after + max_window (so the total
    # window cannot exceed the cap). min_headroom << max_window, so the floor is
    # always below the ceiling and a clamp can satisfy both.
    floor = now_sec + min_headroom_sec
    ceiling = valid_after + max_window_sec

    too_tight = raw_valid_before < floor
    too_wide = raw_valid_before > ceiling

    # A caller-pinned valid_before that is out of band is a no-clamp hard error
    # so it never silently signs a window other than the one requested.
    if not clamp and valid_before_sec is not None:
        if too_tight:
            raise ValueError(
                f"invalid validity window: valid_before ({raw_valid_before}) is "
                f"below the minimum settlement headroom (must be >= now + "
                f"{min_headroom_sec}s = {floor}); the authorization would be "
                "rejected as about to expire"
            )
        if too_wide:
            raise ValueError(
                f"invalid validity window: valid_before ({raw_valid_before}) "
                f"exceeds the {max_window_sec}s window cap (must be <= valid_after "
                f"+ {max_window_sec}s = {ceiling}); the authorization window is "
                "too wide"
            )

    # Default path (or clamp enabled): land valid_before inside [floor, ceiling].
    if too_tight:
        banded_valid_before = floor
    elif too_wide:
        banded_valid_before = ceiling
    else:
        banded_valid_before = raw_valid_before

    if banded_valid_before <= valid_after:
        # Only reachable when a pinned valid_after sits at/after the floor; the
        # window is unrecoverable without moving the caller's pinned valid_after.
        raise ValueError(
            "invalid validity window: valid_before must be after valid_after "
            "(challenge already expired or valid_after pinned too late?)"
        )

    return valid_after, banded_valid_before


def sign_interaction_payment(
    *,
    sign: Callable[[dict[str, Any]], str],
    payer: str,
    domain: TokenDomain,
    pay_to: str,
    amount: int,
    nonce_binding: NonceBinding,
    valid_after: int,
    valid_before: int,
) -> tuple[TransferAuthorization, str]:
    """Derive the bound nonce, assemble the authorization, and sign it.

    ``sign`` is a callable taking the EIP-712 typed-data document and returning a
    ``0x`` hex signature (e.g. ``PrivateKeySigner.sign_typed_data``). This is the
    one piece a stock x402 signer cannot do (it generates the nonce internally
    with no injection point). The key never leaves the caller. Returns
    ``(authorization, signature)``.
    """
    authorization = TransferAuthorization(
        from_=payer,
        to=pay_to,
        value=amount,
        valid_after=valid_after,
        valid_before=valid_before,
        nonce=derive_eip3009_nonce(nonce_binding),
    )
    signature = sign(transfer_with_authorization_typed_data(domain, authorization))
    return authorization, signature


# A shape-valid EIP signature is 65 bytes (r,s,v) rendered as 130 hex chars.
_SIGNATURE_HEX_RE = re.compile(r"^0x[0-9a-fA-F]{130}$")
# An EIP-3009 nonce is 32 bytes rendered as 64 hex chars.
_NONCE_HEX_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")


def build_exact_evm_payment_payload(
    *,
    network: str,
    authorization: TransferAuthorization,
    signature: str,
) -> X402PaymentPayload:
    """Assemble (and validate) the exact-EVM x402 wire payload.

    The numeric authorization fields are decimal strings in the wire schema, so
    the ints are stringified; the nonce passes through as hex. Validation rejects
    a malformed nonce or signature loudly rather than emitting a payload the
    platform will reject.
    """
    if network not in ("base", "base-sepolia"):
        raise ValueError(
            f"build_exact_evm_payment_payload: unsupported network {network}"
        )
    if not _SIGNATURE_HEX_RE.fullmatch(signature):
        raise ValueError(
            "build_exact_evm_payment_payload: signature must be a 0x-prefixed "
            "65-byte (130 hex char) EIP signature"
        )
    if not _NONCE_HEX_RE.fullmatch(authorization.nonce):
        raise ValueError(
            "build_exact_evm_payment_payload: authorization.nonce must be a "
            "0x-prefixed 32-byte (64 hex char) value"
        )
    return to_payment_payload(network, authorization, signature)


def _hex_to_bytes(value: str) -> bytes:
    return bytes.fromhex(value[2:] if value.startswith("0x") else value)


def _to_hex(value: bytes) -> str:
    return "0x" + value.hex()
