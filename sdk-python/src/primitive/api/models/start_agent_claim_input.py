from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="StartAgentClaimInput")



@_attrs_define
class StartAgentClaimInput:
    """ 
        Attributes:
            email (str): Email to confirm. Must not already belong to a Primitive account.
     """

    email: str





    def to_dict(self) -> dict[str, Any]:
        email = self.email


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "email": email,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email = d.pop("email")

        start_agent_claim_input = cls(
            email=email,
        )

        return start_agent_claim_input

