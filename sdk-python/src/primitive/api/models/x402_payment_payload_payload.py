from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.x402_payment_payload_payload_authorization import X402PaymentPayloadPayloadAuthorization





T = TypeVar("T", bound="X402PaymentPayloadPayload")



@_attrs_define
class X402PaymentPayloadPayload:
    """ 
        Attributes:
            signature (str): The EIP-712 signature over the authorization.
            authorization (X402PaymentPayloadPayloadAuthorization): The EIP-3009 `transferWithAuthorization` fields, as
                strings.
     """

    signature: str
    authorization: X402PaymentPayloadPayloadAuthorization
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.x402_payment_payload_payload_authorization import X402PaymentPayloadPayloadAuthorization
        signature = self.signature

        authorization = self.authorization.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "signature": signature,
            "authorization": authorization,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.x402_payment_payload_payload_authorization import X402PaymentPayloadPayloadAuthorization
        d = dict(src_dict)
        signature = d.pop("signature")

        authorization = X402PaymentPayloadPayloadAuthorization.from_dict(d.pop("authorization"))




        x402_payment_payload_payload = cls(
            signature=signature,
            authorization=authorization,
        )


        x402_payment_payload_payload.additional_properties = d
        return x402_payment_payload_payload

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
