from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_agent_networks_response_200_data_item_kind import ListAgentNetworksResponse200DataItemKind
from uuid import UUID






T = TypeVar("T", bound="ListAgentNetworksResponse200DataItem")



@_attrs_define
class ListAgentNetworksResponse200DataItem:
    """
        Attributes:
            id (UUID):
            kind (ListAgentNetworksResponse200DataItemKind):
            is_default (bool):
            name (str):
            can_manage_all (bool):
     """

    id: UUID
    kind: ListAgentNetworksResponse200DataItemKind
    is_default: bool
    name: str
    can_manage_all: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        kind = self.kind.value

        is_default = self.is_default

        name = self.name

        can_manage_all = self.can_manage_all


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "kind": kind,
            "is_default": is_default,
            "name": name,
            "can_manage_all": can_manage_all,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        kind = ListAgentNetworksResponse200DataItemKind(d.pop("kind"))




        is_default = d.pop("is_default")

        name = d.pop("name")

        can_manage_all = d.pop("can_manage_all")

        list_agent_networks_response_200_data_item = cls(
            id=id,
            kind=kind,
            is_default=is_default,
            name=name,
            can_manage_all=can_manage_all,
        )


        list_agent_networks_response_200_data_item.additional_properties = d
        return list_agent_networks_response_200_data_item

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
