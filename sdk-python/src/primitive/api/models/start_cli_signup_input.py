from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.start_cli_signup_input_metadata import StartCliSignupInputMetadata





T = TypeVar("T", bound="StartCliSignupInput")



@_attrs_define
class StartCliSignupInput:
    """ 
        Attributes:
            email (str):
            terms_accepted (bool): Must be true to confirm acceptance of Primitive's Terms of Service and Privacy Policy
            signup_code (str | Unset): Optional bonus signup code. Omit for open signup; new orgs still receive the baseline
                entitlements via bootstrap.
            device_name (str | Unset): Human-readable device name used for the created CLI OAuth grant
            metadata (StartCliSignupInputMetadata | Unset): Optional client metadata stored with the signup session;
                serialized JSON must be 2048 bytes or fewer
     """

    email: str
    terms_accepted: bool
    signup_code: str | Unset = UNSET
    device_name: str | Unset = UNSET
    metadata: StartCliSignupInputMetadata | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.start_cli_signup_input_metadata import StartCliSignupInputMetadata
        email = self.email

        terms_accepted = self.terms_accepted

        signup_code = self.signup_code

        device_name = self.device_name

        metadata: dict[str, Any] | Unset = UNSET
        if not isinstance(self.metadata, Unset):
            metadata = self.metadata.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "email": email,
            "terms_accepted": terms_accepted,
        })
        if signup_code is not UNSET:
            field_dict["signup_code"] = signup_code
        if device_name is not UNSET:
            field_dict["device_name"] = device_name
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.start_cli_signup_input_metadata import StartCliSignupInputMetadata
        d = dict(src_dict)
        email = d.pop("email")

        terms_accepted = d.pop("terms_accepted")

        signup_code = d.pop("signup_code", UNSET)

        device_name = d.pop("device_name", UNSET)

        _metadata = d.pop("metadata", UNSET)
        metadata: StartCliSignupInputMetadata | Unset
        if isinstance(_metadata,  Unset):
            metadata = UNSET
        else:
            metadata = StartCliSignupInputMetadata.from_dict(_metadata)




        start_cli_signup_input = cls(
            email=email,
            terms_accepted=terms_accepted,
            signup_code=signup_code,
            device_name=device_name,
            metadata=metadata,
        )

        return start_cli_signup_input

