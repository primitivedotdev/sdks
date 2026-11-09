from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="ListFunctionRuntimeKeyPresetsResultPresetsItem")



@_attrs_define
class ListFunctionRuntimeKeyPresetsResultPresetsItem:
    """ 
        Attributes:
            id (str):
            label (str):
            description (str):
            available (bool):
            reason (None | str):
            differs_from_today (bool):
     """

    id: str
    label: str
    description: str
    available: bool
    reason: None | str
    differs_from_today: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        label = self.label

        description = self.description

        available = self.available

        reason: None | str
        reason = self.reason

        differs_from_today = self.differs_from_today


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "label": label,
            "description": description,
            "available": available,
            "reason": reason,
            "differs_from_today": differs_from_today,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        label = d.pop("label")

        description = d.pop("description")

        available = d.pop("available")

        def _parse_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        reason = _parse_reason(d.pop("reason"))


        differs_from_today = d.pop("differs_from_today")

        list_function_runtime_key_presets_result_presets_item = cls(
            id=id,
            label=label,
            description=description,
            available=available,
            reason=reason,
            differs_from_today=differs_from_today,
        )


        list_function_runtime_key_presets_result_presets_item.additional_properties = d
        return list_function_runtime_key_presets_result_presets_item

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
