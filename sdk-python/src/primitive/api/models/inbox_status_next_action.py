from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.inbox_status_next_action_kind import InboxStatusNextActionKind






T = TypeVar("T", bound="InboxStatusNextAction")



@_attrs_define
class InboxStatusNextAction:
    """ 
        Attributes:
            kind (InboxStatusNextActionKind):
            message (str): Human-readable next step.
            command (str | Unset): Suggested Primitive CLI command when there is an obvious next step.
     """

    kind: InboxStatusNextActionKind
    message: str
    command: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        message = self.message

        command = self.command


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "message": message,
        })
        if command is not UNSET:
            field_dict["command"] = command

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = InboxStatusNextActionKind(d.pop("kind"))




        message = d.pop("message")

        command = d.pop("command", UNSET)

        inbox_status_next_action = cls(
            kind=kind,
            message=message,
            command=command,
        )


        inbox_status_next_action.additional_properties = d
        return inbox_status_next_action

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
