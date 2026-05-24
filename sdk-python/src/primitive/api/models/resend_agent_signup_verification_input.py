from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ResendAgentSignupVerificationInput")



@_attrs_define
class ResendAgentSignupVerificationInput:
    """ 
        Attributes:
            signup_token (str):
     """

    signup_token: str





    def to_dict(self) -> dict[str, Any]:
        signup_token = self.signup_token


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "signup_token": signup_token,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        signup_token = d.pop("signup_token")

        resend_agent_signup_verification_input = cls(
            signup_token=signup_token,
        )

        return resend_agent_signup_verification_input

