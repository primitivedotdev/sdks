from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ClaimVanityInboxNameRequest")



@_attrs_define
class ClaimVanityInboxNameRequest:
    """ 
        Attributes:
            name (str):
     """

    name: str





    def to_dict(self) -> dict[str, Any]:
        name = self.name


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        claim_vanity_inbox_name_request = cls(
            name=name,
        )

        return claim_vanity_inbox_name_request

