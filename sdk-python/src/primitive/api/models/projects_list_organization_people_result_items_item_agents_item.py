from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="ProjectsListOrganizationPeopleResultItemsItemAgentsItem")



@_attrs_define
class ProjectsListOrganizationPeopleResultItemsItemAgentsItem:
    """ 
        Attributes:
            id (UUID):
            address (str):
            name (str):
     """

    id: UUID
    address: str
    name: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        address = self.address

        name = self.name


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "address": address,
            "name": name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        address = d.pop("address")

        name = d.pop("name")

        projects_list_organization_people_result_items_item_agents_item = cls(
            id=id,
            address=address,
            name=name,
        )


        projects_list_organization_people_result_items_item_agents_item.additional_properties = d
        return projects_list_organization_people_result_items_item_agents_item

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
