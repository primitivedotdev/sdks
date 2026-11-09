from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_function_runtime_key_presets_result_presets_item import ListFunctionRuntimeKeyPresetsResultPresetsItem





T = TypeVar("T", bound="ListFunctionRuntimeKeyPresetsResult")



@_attrs_define
class ListFunctionRuntimeKeyPresetsResult:
    """ 
        Attributes:
            enabled (bool):
            presets (list[ListFunctionRuntimeKeyPresetsResultPresetsItem]):
     """

    enabled: bool
    presets: list[ListFunctionRuntimeKeyPresetsResultPresetsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_function_runtime_key_presets_result_presets_item import ListFunctionRuntimeKeyPresetsResultPresetsItem # noqa: PLC0415
        enabled = self.enabled

        presets = []
        for presets_item_data in self.presets:
            presets_item = presets_item_data.to_dict()
            presets.append(presets_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "enabled": enabled,
            "presets": presets,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_function_runtime_key_presets_result_presets_item import ListFunctionRuntimeKeyPresetsResultPresetsItem # noqa: PLC0415
        d = dict(src_dict)
        enabled = d.pop("enabled")

        presets = []
        _presets = d.pop("presets")
        for presets_item_data in (_presets):
            presets_item = ListFunctionRuntimeKeyPresetsResultPresetsItem.from_dict(presets_item_data)



            presets.append(presets_item)


        list_function_runtime_key_presets_result = cls(
            enabled=enabled,
            presets=presets,
        )


        list_function_runtime_key_presets_result.additional_properties = d
        return list_function_runtime_key_presets_result

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
