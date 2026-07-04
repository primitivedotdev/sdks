from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TemplateAuthor")



@_attrs_define
class TemplateAuthor:
    """ 
        Attributes:
            id (str):
            name (str):
            url (str | Unset):
     """

    id: str
    name: str
    url: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        name = self.name

        url = self.url


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
        })
        if url is not UNSET:
            field_dict["url"] = url

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        name = d.pop("name")

        url = d.pop("url", UNSET)

        template_author = cls(
            id=id,
            name=name,
            url=url,
        )

        return template_author

