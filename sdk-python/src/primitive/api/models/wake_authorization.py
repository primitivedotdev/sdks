from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="WakeAuthorization")



@_attrs_define
class WakeAuthorization:
    """ A per-target allowlist grant authorizing a sender to wake a function.

        Attributes:
            id (UUID):
            recipient_endpoint_id (UUID):
            allowed_sender_domain (str):
            enabled (bool):
            created_at (datetime.datetime):
            allowed_sender_address (None | str | Unset):
            allowed_commands (list[str] | None | Unset):
            note (None | str | Unset):
     """

    id: UUID
    recipient_endpoint_id: UUID
    allowed_sender_domain: str
    enabled: bool
    created_at: datetime.datetime
    allowed_sender_address: None | str | Unset = UNSET
    allowed_commands: list[str] | None | Unset = UNSET
    note: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        recipient_endpoint_id = str(self.recipient_endpoint_id)

        allowed_sender_domain = self.allowed_sender_domain

        enabled = self.enabled

        created_at = self.created_at.isoformat()

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

        note: None | str | Unset
        if isinstance(self.note, Unset):
            note = UNSET
        else:
            note = self.note


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "recipient_endpoint_id": recipient_endpoint_id,
            "allowed_sender_domain": allowed_sender_domain,
            "enabled": enabled,
            "created_at": created_at,
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
        id = UUID(d.pop("id"))




        recipient_endpoint_id = UUID(d.pop("recipient_endpoint_id"))




        allowed_sender_domain = d.pop("allowed_sender_domain")

        enabled = d.pop("enabled")

        created_at = isoparse(d.pop("created_at"))




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


        def _parse_note(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        note = _parse_note(d.pop("note", UNSET))


        wake_authorization = cls(
            id=id,
            recipient_endpoint_id=recipient_endpoint_id,
            allowed_sender_domain=allowed_sender_domain,
            enabled=enabled,
            created_at=created_at,
            allowed_sender_address=allowed_sender_address,
            allowed_commands=allowed_commands,
            note=note,
        )


        wake_authorization.additional_properties = d
        return wake_authorization

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
