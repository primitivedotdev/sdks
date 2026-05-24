from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.start_agent_signup_input_metadata import StartAgentSignupInputMetadata





T = TypeVar("T", bound="StartAgentSignupInput")



@_attrs_define
class StartAgentSignupInput:
    """ 
        Attributes:
            email (str):
            signup_code (str):
            terms_accepted (bool): Must be true to confirm acceptance of Primitive's Terms of Service and Privacy Policy
            device_name (str | Unset): Human-readable device name used for the created agent OAuth session
            metadata (StartAgentSignupInputMetadata | Unset): Optional client metadata stored with the signup session;
                serialized JSON must be 2048 bytes or fewer
     """

    email: str
    signup_code: str
    terms_accepted: bool
    device_name: str | Unset = UNSET
    metadata: StartAgentSignupInputMetadata | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.start_agent_signup_input_metadata import StartAgentSignupInputMetadata
        email = self.email

        signup_code = self.signup_code

        terms_accepted = self.terms_accepted

        device_name = self.device_name

        metadata: dict[str, Any] | Unset = UNSET
        if not isinstance(self.metadata, Unset):
            metadata = self.metadata.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "email": email,
            "signup_code": signup_code,
            "terms_accepted": terms_accepted,
        })
        if device_name is not UNSET:
            field_dict["device_name"] = device_name
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.start_agent_signup_input_metadata import StartAgentSignupInputMetadata
        d = dict(src_dict)
        email = d.pop("email")

        signup_code = d.pop("signup_code")

        terms_accepted = d.pop("terms_accepted")

        device_name = d.pop("device_name", UNSET)

        _metadata = d.pop("metadata", UNSET)
        metadata: StartAgentSignupInputMetadata | Unset
        if isinstance(_metadata,  Unset):
            metadata = UNSET
        else:
            metadata = StartAgentSignupInputMetadata.from_dict(_metadata)




        start_agent_signup_input = cls(
            email=email,
            signup_code=signup_code,
            terms_accepted=terms_accepted,
            device_name=device_name,
            metadata=metadata,
        )

        return start_agent_signup_input

