from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_send_from_response_200_data_addresses_item_kind import GetSendFromResponse200DataAddressesItemKind






T = TypeVar("T", bound="GetSendFromResponse200DataAddressesItem")



@_attrs_define
class GetSendFromResponse200DataAddressesItem:
    """ 
        Attributes:
            address (str):
            kind (GetSendFromResponse200DataAddressesItemKind): agent_address: this connected agent's own address.
                member_address: your own member address. granted: an address this credential's grant names.
     """

    address: str
    kind: GetSendFromResponse200DataAddressesItemKind
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        kind = self.kind.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "kind": kind,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        kind = GetSendFromResponse200DataAddressesItemKind(d.pop("kind"))




        get_send_from_response_200_data_addresses_item = cls(
            address=address,
            kind=kind,
        )


        get_send_from_response_200_data_addresses_item.additional_properties = d
        return get_send_from_response_200_data_addresses_item

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
