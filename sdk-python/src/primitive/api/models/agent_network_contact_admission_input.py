from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="AgentNetworkContactAdmissionInput")



@_attrs_define
class AgentNetworkContactAdmissionInput:
    """ 
        Attributes:
            sender_address (str):
     """

    sender_address: str





    def to_dict(self) -> dict[str, Any]:
        sender_address = self.sender_address


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sender_address": sender_address,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        sender_address = d.pop("sender_address")

        agent_network_contact_admission_input = cls(
            sender_address=sender_address,
        )

        return agent_network_contact_admission_input

