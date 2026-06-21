from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="CreateAgentAccountInput")



@_attrs_define
class CreateAgentAccountInput:
    """ 
        Attributes:
            terms_accepted (bool): Must be true to accept the Terms of Service and Privacy Policy.
            device_name (str | Unset): Optional label for the device or agent creating the account.
     """

    terms_accepted: bool
    device_name: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        terms_accepted = self.terms_accepted

        device_name = self.device_name


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "terms_accepted": terms_accepted,
        })
        if device_name is not UNSET:
            field_dict["device_name"] = device_name

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        terms_accepted = d.pop("terms_accepted")

        device_name = d.pop("device_name", UNSET)

        create_agent_account_input = cls(
            terms_accepted=terms_accepted,
            device_name=device_name,
        )

        return create_agent_account_input

