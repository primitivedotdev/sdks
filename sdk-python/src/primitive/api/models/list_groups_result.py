from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_groups_result_groups_item import ListGroupsResultGroupsItem





T = TypeVar("T", bound="ListGroupsResult")



@_attrs_define
class ListGroupsResult:
    """ 
        Attributes:
            groups (list[ListGroupsResultGroupsItem]):
     """

    groups: list[ListGroupsResultGroupsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_groups_result_groups_item import ListGroupsResultGroupsItem # noqa: PLC0415
        groups = []
        for groups_item_data in self.groups:
            groups_item = groups_item_data.to_dict()
            groups.append(groups_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "groups": groups,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_groups_result_groups_item import ListGroupsResultGroupsItem # noqa: PLC0415
        d = dict(src_dict)
        groups = []
        _groups = d.pop("groups")
        for groups_item_data in (_groups):
            groups_item = ListGroupsResultGroupsItem.from_dict(groups_item_data)



            groups.append(groups_item)


        list_groups_result = cls(
            groups=groups,
        )


        list_groups_result.additional_properties = d
        return list_groups_result

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
