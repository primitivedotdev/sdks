from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="VerifyAgentClaimInput")



@_attrs_define
class VerifyAgentClaimInput:
    """ 
        Attributes:
            verification_code (str): The verification code emailed by the claim start step.
     """

    verification_code: str





    def to_dict(self) -> dict[str, Any]:
        verification_code = self.verification_code


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "verification_code": verification_code,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        verification_code = d.pop("verification_code")

        verify_agent_claim_input = cls(
            verification_code=verification_code,
        )

        return verify_agent_claim_input

