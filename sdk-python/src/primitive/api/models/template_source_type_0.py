from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.template_source_type_0_mode import TemplateSourceType0Mode






T = TypeVar("T", bound="TemplateSourceType0")



@_attrs_define
class TemplateSourceType0:
    """ 
        Attributes:
            mode (TemplateSourceType0Mode):
            dir_ (str):  Default: '.'.
     """

    mode: TemplateSourceType0Mode
    dir_: str = '.'
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        dir_ = self.dir_


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "mode": mode,
            "dir": dir_,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = TemplateSourceType0Mode(d.pop("mode"))




        dir_ = d.pop("dir")

        template_source_type_0 = cls(
            mode=mode,
            dir_=dir_,
        )


        template_source_type_0.additional_properties = d
        return template_source_type_0

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
