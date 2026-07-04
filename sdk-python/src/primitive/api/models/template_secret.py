from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TemplateSecret")



@_attrs_define
class TemplateSecret:
    """ 
        Attributes:
            key (str):
            required (bool):  Default: True.
            description (str | Unset):
     """

    key: str
    required: bool = True
    description: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        required = self.required

        description = self.description


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "required": required,
        })
        if description is not UNSET:
            field_dict["description"] = description

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        required = d.pop("required")

        description = d.pop("description", UNSET)

        template_secret = cls(
            key=key,
            required=required,
            description=description,
        )

        return template_secret

