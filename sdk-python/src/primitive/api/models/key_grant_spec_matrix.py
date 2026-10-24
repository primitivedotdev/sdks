from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.key_grant_spec_matrix_additional_property import KeyGrantSpecMatrixAdditionalProperty






T = TypeVar("T", bound="KeyGrantSpecMatrix")



@_attrs_define
class KeyGrantSpecMatrix:
    

    additional_properties: dict[str, KeyGrantSpecMatrixAdditionalProperty] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        
        field_dict: dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop.value


        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key_grant_spec_matrix = cls(
        )


        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = KeyGrantSpecMatrixAdditionalProperty(prop_dict)



            additional_properties[prop_name] = additional_property

        key_grant_spec_matrix.additional_properties = additional_properties
        return key_grant_spec_matrix

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> KeyGrantSpecMatrixAdditionalProperty:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: KeyGrantSpecMatrixAdditionalProperty) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
