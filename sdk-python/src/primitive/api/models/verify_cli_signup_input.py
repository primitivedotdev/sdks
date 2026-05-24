from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="VerifyCliSignupInput")



@_attrs_define
class VerifyCliSignupInput:
    """ 
        Attributes:
            signup_token (str):
            verification_code (str):
            password (str | Unset):
     """

    signup_token: str
    verification_code: str
    password: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        signup_token = self.signup_token

        verification_code = self.verification_code

        password = self.password


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "signup_token": signup_token,
            "verification_code": verification_code,
        })
        if password is not UNSET:
            field_dict["password"] = password

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        signup_token = d.pop("signup_token")

        verification_code = d.pop("verification_code")

        password = d.pop("password", UNSET)

        verify_cli_signup_input = cls(
            signup_token=signup_token,
            verification_code=verification_code,
            password=password,
        )

        return verify_cli_signup_input

