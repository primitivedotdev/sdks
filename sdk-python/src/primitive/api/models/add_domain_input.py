from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="AddDomainInput")



@_attrs_define
class AddDomainInput:
    """ 
        Attributes:
            domain (str): The domain name to claim (e.g. "example.com")
     """

    domain: str





    def to_dict(self) -> dict[str, Any]:
        domain = self.domain


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "domain": domain,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        domain = d.pop("domain")

        add_domain_input = cls(
            domain=domain,
        )

        return add_domain_input

