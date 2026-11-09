from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TemplateVariableValidation")



@_attrs_define
class TemplateVariableValidation:
    """ 
        Attributes:
            pattern (str | Unset):
            max_length (int | Unset):
     """

    pattern: str | Unset = UNSET
    max_length: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        pattern = self.pattern

        max_length = self.max_length


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if pattern is not UNSET:
            field_dict["pattern"] = pattern
        if max_length is not UNSET:
            field_dict["maxLength"] = max_length

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        pattern = d.pop("pattern", UNSET)

        max_length = d.pop("maxLength", UNSET)

        template_variable_validation = cls(
            pattern=pattern,
            max_length=max_length,
        )


        template_variable_validation.additional_properties = d
        return template_variable_validation

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
