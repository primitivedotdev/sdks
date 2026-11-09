from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="UpdateFunctionTagsRequest")



@_attrs_define
class UpdateFunctionTagsRequest:
    """ 
        Attributes:
            tags (list[str]):
     """

    tags: list[str]





    def to_dict(self) -> dict[str, Any]:
        tags = self.tags




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "tags": tags,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        tags = cast(list[str], d.pop("tags"))


        update_function_tags_request = cls(
            tags=tags,
        )

        return update_function_tags_request

