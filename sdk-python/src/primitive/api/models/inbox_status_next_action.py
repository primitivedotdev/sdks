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





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        message = self.message

        command = self.command


        field_dict: dict[str, Any] = {}

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

        return inbox_status_next_action

