from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="TemplateSecretGroup")



@_attrs_define
class TemplateSecretGroup:
    """ 
        Attributes:
            keys (list[str]):
            min_ (int):  Default: 1.
            description (str | Unset):
     """

    keys: list[str]
    min_: int = 1
    description: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        keys = self.keys



        min_ = self.min_

        description = self.description


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "keys": keys,
            "min": min_,
        })
        if description is not UNSET:
            field_dict["description"] = description

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        keys = cast(list[str], d.pop("keys"))


        min_ = d.pop("min")

        description = d.pop("description", UNSET)

        template_secret_group = cls(
            keys=keys,
            min_=min_,
            description=description,
        )

        return template_secret_group

