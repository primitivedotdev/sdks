from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="SetRelayAutoJoinRequest")



@_attrs_define
class SetRelayAutoJoinRequest:
    """ 
        Attributes:
            option (None | str):
     """

    option: None | str





    def to_dict(self) -> dict[str, Any]:
        option: None | str
        option = self.option


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "option": option,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_option(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        option = _parse_option(d.pop("option"))


        set_relay_auto_join_request = cls(
            option=option,
        )

        return set_relay_auto_join_request

