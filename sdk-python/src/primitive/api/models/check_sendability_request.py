from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="CheckSendabilityRequest")



@_attrs_define
class CheckSendabilityRequest:
    """ 
        Attributes:
            to (str):
            from_ (str | Unset):
     """

    to: str
    from_: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        to = self.to

        from_ = self.from_


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "to": to,
        })
        if from_ is not UNSET:
            field_dict["from"] = from_

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        to = d.pop("to")

        from_ = d.pop("from", UNSET)

        check_sendability_request = cls(
            to=to,
            from_=from_,
        )

        return check_sendability_request

