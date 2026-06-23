from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.x402_payment_payload_network import X402PaymentPayloadNetwork
from typing import cast
from typing import Literal, cast

if TYPE_CHECKING:
  from ..models.x402_payment_payload_payload import X402PaymentPayloadPayload





T = TypeVar("T", bound="X402PaymentPayload")



@_attrs_define
class X402PaymentPayload:
    """ A signed x402 v1 `PaymentPayload`. The SDK `pay()` helper builds this;
    callers rarely construct it by hand. Field names are x402-native.

        Attributes:
            x_402_version (Literal[1]):
            scheme (Literal['exact']):
            network (X402PaymentPayloadNetwork):
            payload (X402PaymentPayloadPayload):
     """

    x_402_version: Literal[1]
    scheme: Literal['exact']
    network: X402PaymentPayloadNetwork
    payload: X402PaymentPayloadPayload
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.x402_payment_payload_payload import X402PaymentPayloadPayload
        x_402_version = self.x_402_version

        scheme = self.scheme

        network = self.network.value

        payload = self.payload.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "x402Version": x_402_version,
            "scheme": scheme,
            "network": network,
            "payload": payload,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.x402_payment_payload_payload import X402PaymentPayloadPayload
        d = dict(src_dict)
        x_402_version = cast(Literal[1] , d.pop("x402Version"))
        if x_402_version != 1:
            raise ValueError(f"x402Version must match const 1, got '{x_402_version}'")

        scheme = cast(Literal['exact'] , d.pop("scheme"))
        if scheme != 'exact':
            raise ValueError(f"scheme must match const 'exact', got '{scheme}'")

        network = X402PaymentPayloadNetwork(d.pop("network"))




        payload = X402PaymentPayloadPayload.from_dict(d.pop("payload"))




        x402_payment_payload = cls(
            x_402_version=x_402_version,
            scheme=scheme,
            network=network,
            payload=payload,
        )


        x402_payment_payload.additional_properties = d
        return x402_payment_payload

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
