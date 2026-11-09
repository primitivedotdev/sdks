from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_break_glass_result_grants_item import ListBreakGlassResultGrantsItem





T = TypeVar("T", bound="ListBreakGlassResult")



@_attrs_define
class ListBreakGlassResult:
    """ 
        Attributes:
            grants (list[ListBreakGlassResultGrantsItem]):
     """

    grants: list[ListBreakGlassResultGrantsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_break_glass_result_grants_item import ListBreakGlassResultGrantsItem # noqa: PLC0415
        grants = []
        for grants_item_data in self.grants:
            grants_item = grants_item_data.to_dict()
            grants.append(grants_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "grants": grants,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_break_glass_result_grants_item import ListBreakGlassResultGrantsItem # noqa: PLC0415
        d = dict(src_dict)
        grants = []
        _grants = d.pop("grants")
        for grants_item_data in (_grants):
            grants_item = ListBreakGlassResultGrantsItem.from_dict(grants_item_data)



            grants.append(grants_item)


        list_break_glass_result = cls(
            grants=grants,
        )


        list_break_glass_result.additional_properties = d
        return list_break_glass_result

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
