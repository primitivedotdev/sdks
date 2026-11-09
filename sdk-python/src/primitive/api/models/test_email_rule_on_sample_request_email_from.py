from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TestEmailRuleOnSampleRequestEmailFrom")



@_attrs_define
class TestEmailRuleOnSampleRequestEmailFrom:
    """ 
        Attributes:
            address (str):
            name (str | Unset):
     """

    address: str
    name: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        name = self.name


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "address": address,
        })
        if name is not UNSET:
            field_dict["name"] = name

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        name = d.pop("name", UNSET)

        test_email_rule_on_sample_request_email_from = cls(
            address=address,
            name=name,
        )

        return test_email_rule_on_sample_request_email_from

