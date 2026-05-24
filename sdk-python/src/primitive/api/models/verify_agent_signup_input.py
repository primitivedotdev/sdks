from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="VerifyAgentSignupInput")



@_attrs_define
class VerifyAgentSignupInput:
    """ 
        Attributes:
            signup_token (str):
            verification_code (str):
            org_id (UUID | Unset): Optional workspace id to target when the verified email already belongs to multiple
                workspaces
     """

    signup_token: str
    verification_code: str
    org_id: UUID | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        signup_token = self.signup_token

        verification_code = self.verification_code

        org_id: str | Unset = UNSET
        if not isinstance(self.org_id, Unset):
            org_id = str(self.org_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "signup_token": signup_token,
            "verification_code": verification_code,
        })
        if org_id is not UNSET:
            field_dict["org_id"] = org_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        signup_token = d.pop("signup_token")

        verification_code = d.pop("verification_code")

        _org_id = d.pop("org_id", UNSET)
        org_id: UUID | Unset
        if isinstance(_org_id,  Unset):
            org_id = UNSET
        else:
            org_id = UUID(_org_id)




        verify_agent_signup_input = cls(
            signup_token=signup_token,
            verification_code=verification_code,
            org_id=org_id,
        )

        return verify_agent_signup_input

