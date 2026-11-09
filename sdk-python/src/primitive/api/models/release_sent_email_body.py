from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="ReleaseSentEmailBody")



@_attrs_define
class ReleaseSentEmailBody:
    """ 
        Attributes:
            scheduled_at (datetime.datetime | Unset): A new time for the send, in the future.
     """

    scheduled_at: datetime.datetime | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        scheduled_at: str | Unset = UNSET
        if not isinstance(self.scheduled_at, Unset):
            scheduled_at = self.scheduled_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if scheduled_at is not UNSET:
            field_dict["scheduled_at"] = scheduled_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _scheduled_at = d.pop("scheduled_at", UNSET)
        scheduled_at: datetime.datetime | Unset
        if isinstance(_scheduled_at,  Unset):
            scheduled_at = UNSET
        else:
            scheduled_at = datetime.datetime.fromisoformat(_scheduled_at)




        release_sent_email_body = cls(
            scheduled_at=scheduled_at,
        )

        return release_sent_email_body

