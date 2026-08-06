from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="SentEmailRescheduleInput")



@_attrs_define
class SentEmailRescheduleInput:
    """ 
        Attributes:
            scheduled_at (datetime.datetime): New execution time (ISO 8601). Must be in the future and
                at most 30 days out, the same bounds as the create-time
                field on /send-mail.
     """

    scheduled_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        scheduled_at = self.scheduled_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "scheduled_at": scheduled_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        scheduled_at = isoparse(d.pop("scheduled_at"))




        sent_email_reschedule_input = cls(
            scheduled_at=scheduled_at,
        )

        return sent_email_reschedule_input

