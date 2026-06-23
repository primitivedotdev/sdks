from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.x402_payment_payload import X402PaymentPayload





T = TypeVar("T", bound="PayChallengeInput")



@_attrs_define
class PayChallengeInput:
    """ 
        Attributes:
            payment (X402PaymentPayload): A signed x402 v1 `PaymentPayload`. The SDK `pay()` helper builds this;
                callers rarely construct it by hand. Field names are x402-native.
     """

    payment: X402PaymentPayload





    def to_dict(self) -> dict[str, Any]:
        from ..models.x402_payment_payload import X402PaymentPayload
        payment = self.payment.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "payment": payment,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.x402_payment_payload import X402PaymentPayload
        d = dict(src_dict)
        payment = X402PaymentPayload.from_dict(d.pop("payment"))




        pay_challenge_input = cls(
            payment=payment,
        )

        return pay_challenge_input

