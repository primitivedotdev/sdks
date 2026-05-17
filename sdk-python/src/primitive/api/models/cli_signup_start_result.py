from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="CliSignupStartResult")



@_attrs_define
class CliSignupStartResult:
    """ 
        Attributes:
            signup_token (str): Opaque token used to verify or resend the pending CLI signup
            email (str):
            expires_in (int): Seconds until the pending signup expires
            resend_after (int): Minimum seconds before requesting another verification email
            verification_code_length (int): Number of digits in the emailed verification code
     """

    signup_token: str
    email: str
    expires_in: int
    resend_after: int
    verification_code_length: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        signup_token = self.signup_token

        email = self.email

        expires_in = self.expires_in

        resend_after = self.resend_after

        verification_code_length = self.verification_code_length


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "signup_token": signup_token,
            "email": email,
            "expires_in": expires_in,
            "resend_after": resend_after,
            "verification_code_length": verification_code_length,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        signup_token = d.pop("signup_token")

        email = d.pop("email")

        expires_in = d.pop("expires_in")

        resend_after = d.pop("resend_after")

        verification_code_length = d.pop("verification_code_length")

        cli_signup_start_result = cls(
            signup_token=signup_token,
            email=email,
            expires_in=expires_in,
            resend_after=resend_after,
            verification_code_length=verification_code_length,
        )


        cli_signup_start_result.additional_properties = d
        return cli_signup_start_result

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
