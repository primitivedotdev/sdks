from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="DeliverySummaryRulesType0Item")



@_attrs_define
class DeliverySummaryRulesType0Item:
    """ 
        Attributes:
            id (str):
            name (str):
            through_share (None | str): The share the receiver reached the rule through; null when it lists the rule itself.
     """

    id: str
    name: str
    through_share: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        name = self.name

        through_share: None | str
        through_share = self.through_share


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "through_share": through_share,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        name = d.pop("name")

        def _parse_through_share(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        through_share = _parse_through_share(d.pop("through_share"))


        delivery_summary_rules_type_0_item = cls(
            id=id,
            name=name,
            through_share=through_share,
        )


        delivery_summary_rules_type_0_item.additional_properties = d
        return delivery_summary_rules_type_0_item

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
