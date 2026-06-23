from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="X402PaymentRequirementsExtra")



@_attrs_define
class X402PaymentRequirementsExtra:
    """ The token's load-bearing EIP-712 domain params. `name` differs by
    chain (Base mainnet USDC is `USD Coin`, Base Sepolia is `USDC`); a
    wrong value produces a signature the verifier rejects.

        Attributes:
            name (str):
            version (str):
     """

    name: str
    version: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        version = self.version


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "version": version,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        version = d.pop("version")

        x402_payment_requirements_extra = cls(
            name=name,
            version=version,
        )


        x402_payment_requirements_extra.additional_properties = d
        return x402_payment_requirements_extra

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
