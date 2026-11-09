from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="MarkThreadReadInput")



@_attrs_define
class MarkThreadReadInput:
    """ Name exactly one of `up_to_email_id` or `up_to`.

        Attributes:
            up_to_email_id (UUID | Unset): An email or sent email in this thread. It and everything that arrived before it
                are read.
            up_to (datetime.datetime | Unset): Everything that arrived at or before this instant is read. A future instant
                is clamped to now.
     """

    up_to_email_id: UUID | Unset = UNSET
    up_to: datetime.datetime | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        up_to_email_id: str | Unset = UNSET
        if not isinstance(self.up_to_email_id, Unset):
            up_to_email_id = str(self.up_to_email_id)

        up_to: str | Unset = UNSET
        if not isinstance(self.up_to, Unset):
            up_to = self.up_to.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if up_to_email_id is not UNSET:
            field_dict["up_to_email_id"] = up_to_email_id
        if up_to is not UNSET:
            field_dict["up_to"] = up_to

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _up_to_email_id = d.pop("up_to_email_id", UNSET)
        up_to_email_id: UUID | Unset
        if isinstance(_up_to_email_id,  Unset):
            up_to_email_id = UNSET
        else:
            up_to_email_id = UUID(_up_to_email_id)




        _up_to = d.pop("up_to", UNSET)
        up_to: datetime.datetime | Unset
        if isinstance(_up_to,  Unset):
            up_to = UNSET
        else:
            up_to = datetime.datetime.fromisoformat(_up_to)




        mark_thread_read_input = cls(
            up_to_email_id=up_to_email_id,
            up_to=up_to,
        )

        return mark_thread_read_input

