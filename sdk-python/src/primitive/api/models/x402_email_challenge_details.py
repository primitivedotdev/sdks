from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.x402_nonce_binding import X402NonceBinding
  from ..models.x402_payment_requirements import X402PaymentRequirements





T = TypeVar("T", bound="X402EmailChallengeDetails")



@_attrs_define
class X402EmailChallengeDetails:
    """ The challenge the payer needs to sign and pay, carried inside an
    email-native challenge response.

        Attributes:
            payment_requirements (X402PaymentRequirements): The x402 `PaymentRequirements` the payer signs over. Field names
                are
                x402's native camelCase, preserved byte-for-byte.
            nonce_binding (X402NonceBinding): The interaction binding the payer hashes into the EIP-3009 nonce
                (`deriveEip3009Nonce`). Pinning the nonce to this binding is what lets an
                x402 payment ride asynchronous transports safely: a replayed challenge
                can't redirect funds and a signed payment can't settle twice.
            expires_at (datetime.datetime): ISO-8601 expiry of the challenge.
     """

    payment_requirements: X402PaymentRequirements
    nonce_binding: X402NonceBinding
    expires_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.x402_nonce_binding import X402NonceBinding
        from ..models.x402_payment_requirements import X402PaymentRequirements
        payment_requirements = self.payment_requirements.to_dict()

        nonce_binding = self.nonce_binding.to_dict()

        expires_at = self.expires_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "payment_requirements": payment_requirements,
            "nonce_binding": nonce_binding,
            "expires_at": expires_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.x402_nonce_binding import X402NonceBinding
        from ..models.x402_payment_requirements import X402PaymentRequirements
        d = dict(src_dict)
        payment_requirements = X402PaymentRequirements.from_dict(d.pop("payment_requirements"))




        nonce_binding = X402NonceBinding.from_dict(d.pop("nonce_binding"))




        expires_at = isoparse(d.pop("expires_at"))




        x402_email_challenge_details = cls(
            payment_requirements=payment_requirements,
            nonce_binding=nonce_binding,
            expires_at=expires_at,
        )


        x402_email_challenge_details.additional_properties = d
        return x402_email_challenge_details

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
