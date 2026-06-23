from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="X402PaymentPayloadPayloadAuthorization")



@_attrs_define
class X402PaymentPayloadPayloadAuthorization:
    """ The EIP-3009 `transferWithAuthorization` fields, as strings.

        Attributes:
            from_ (str):
            to (str):
            value (str):
            valid_after (str):
            valid_before (str):
            nonce (str):
     """

    from_: str
    to: str
    value: str
    valid_after: str
    valid_before: str
    nonce: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from_ = self.from_

        to = self.to

        value = self.value

        valid_after = self.valid_after

        valid_before = self.valid_before

        nonce = self.nonce


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "from": from_,
            "to": to,
            "value": value,
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": nonce,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        from_ = d.pop("from")

        to = d.pop("to")

        value = d.pop("value")

        valid_after = d.pop("validAfter")

        valid_before = d.pop("validBefore")

        nonce = d.pop("nonce")

        x402_payment_payload_payload_authorization = cls(
            from_=from_,
            to=to,
            value=value,
            valid_after=valid_after,
            valid_before=valid_before,
            nonce=nonce,
        )


        x402_payment_payload_payload_authorization.additional_properties = d
        return x402_payment_payload_payload_authorization

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
