from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ClaimAgentConnectionBody")



@_attrs_define
class ClaimAgentConnectionBody:
    """ 
        Attributes:
            token (str):
     """

    token: str





    def to_dict(self) -> dict[str, Any]:
        token = self.token


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "token": token,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        token = d.pop("token")

        claim_agent_connection_body = cls(
            token=token,
        )

        return claim_agent_connection_body

