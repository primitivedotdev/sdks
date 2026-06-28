from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CreateWakeAuthorizationInput")



@_attrs_define
class CreateWakeAuthorizationInput:
    """ 
        Attributes:
            recipient_endpoint_id (UUID):
            allowed_sender_domain (str): Fully-qualified sender domain (at least two labels).
            allowed_sender_address (None | str | Unset): Optional specific sender address to pin the grant to.
            allowed_commands (list[str] | None | Unset): Optional command allowlist; null = any command.
            note (str | Unset):
     """

    recipient_endpoint_id: UUID
    allowed_sender_domain: str
    allowed_sender_address: None | str | Unset = UNSET
    allowed_commands: list[str] | None | Unset = UNSET
    note: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        recipient_endpoint_id = str(self.recipient_endpoint_id)

        allowed_sender_domain = self.allowed_sender_domain

        allowed_sender_address: None | str | Unset
        if isinstance(self.allowed_sender_address, Unset):
            allowed_sender_address = UNSET
        else:
            allowed_sender_address = self.allowed_sender_address

        allowed_commands: list[str] | None | Unset
        if isinstance(self.allowed_commands, Unset):
            allowed_commands = UNSET
        elif isinstance(self.allowed_commands, list):
            allowed_commands = self.allowed_commands


        else:
            allowed_commands = self.allowed_commands

        note = self.note


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "recipient_endpoint_id": recipient_endpoint_id,
            "allowed_sender_domain": allowed_sender_domain,
        })
        if allowed_sender_address is not UNSET:
            field_dict["allowed_sender_address"] = allowed_sender_address
        if allowed_commands is not UNSET:
            field_dict["allowed_commands"] = allowed_commands
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        recipient_endpoint_id = UUID(d.pop("recipient_endpoint_id"))




        allowed_sender_domain = d.pop("allowed_sender_domain")

        def _parse_allowed_sender_address(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        allowed_sender_address = _parse_allowed_sender_address(d.pop("allowed_sender_address", UNSET))


        def _parse_allowed_commands(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                allowed_commands_type_0 = cast(list[str], data)

                return allowed_commands_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        allowed_commands = _parse_allowed_commands(d.pop("allowed_commands", UNSET))


        note = d.pop("note", UNSET)

        create_wake_authorization_input = cls(
            recipient_endpoint_id=recipient_endpoint_id,
            allowed_sender_domain=allowed_sender_domain,
            allowed_sender_address=allowed_sender_address,
            allowed_commands=allowed_commands,
            note=note,
        )

        return create_wake_authorization_input

