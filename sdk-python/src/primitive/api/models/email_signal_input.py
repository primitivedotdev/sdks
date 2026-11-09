from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_signal_input_kind import EmailSignalInputKind






T = TypeVar("T", bound="EmailSignalInput")



@_attrs_define
class EmailSignalInput:
    """ 
        Attributes:
            kind (EmailSignalInputKind): `read`: you read the email. `working`: you are working on it. `typing`: you are
                writing a reply.
            expires_in_seconds (int | Unset): working and typing only: how long the signal holds. Defaults to 30. Not
                allowed for read.
     """

    kind: EmailSignalInputKind
    expires_in_seconds: int | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        expires_in_seconds = self.expires_in_seconds


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
        })
        if expires_in_seconds is not UNSET:
            field_dict["expires_in_seconds"] = expires_in_seconds

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = EmailSignalInputKind(d.pop("kind"))




        expires_in_seconds = d.pop("expires_in_seconds", UNSET)

        email_signal_input = cls(
            kind=kind,
            expires_in_seconds=expires_in_seconds,
        )

        return email_signal_input

