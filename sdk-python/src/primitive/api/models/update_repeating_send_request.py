from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_repeating_send_request_status import UpdateRepeatingSendRequestStatus
from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="UpdateRepeatingSendRequest")



@_attrs_define
class UpdateRepeatingSendRequest:
    """ 
        Attributes:
            status (UpdateRepeatingSendRequestStatus | Unset):
            every_minutes (int | Unset):
            only_if_recipient_idle_minutes (int | None | Unset):
            stoppable_by_recipient (bool | Unset):
            max_sends (int | None | Unset):
            until (datetime.datetime | None | Unset):
            body_text (str | Unset):
            subject (str | Unset):
     """

    status: UpdateRepeatingSendRequestStatus | Unset = UNSET
    every_minutes: int | Unset = UNSET
    only_if_recipient_idle_minutes: int | None | Unset = UNSET
    stoppable_by_recipient: bool | Unset = UNSET
    max_sends: int | None | Unset = UNSET
    until: datetime.datetime | None | Unset = UNSET
    body_text: str | Unset = UNSET
    subject: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value


        every_minutes = self.every_minutes

        only_if_recipient_idle_minutes: int | None | Unset
        if isinstance(self.only_if_recipient_idle_minutes, Unset):
            only_if_recipient_idle_minutes = UNSET
        else:
            only_if_recipient_idle_minutes = self.only_if_recipient_idle_minutes

        stoppable_by_recipient = self.stoppable_by_recipient

        max_sends: int | None | Unset
        if isinstance(self.max_sends, Unset):
            max_sends = UNSET
        else:
            max_sends = self.max_sends

        until: None | str | Unset
        if isinstance(self.until, Unset):
            until = UNSET
        elif isinstance(self.until, datetime.datetime):
            until = self.until.isoformat()
        else:
            until = self.until

        body_text = self.body_text

        subject = self.subject


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if status is not UNSET:
            field_dict["status"] = status
        if every_minutes is not UNSET:
            field_dict["every_minutes"] = every_minutes
        if only_if_recipient_idle_minutes is not UNSET:
            field_dict["only_if_recipient_idle_minutes"] = only_if_recipient_idle_minutes
        if stoppable_by_recipient is not UNSET:
            field_dict["stoppable_by_recipient"] = stoppable_by_recipient
        if max_sends is not UNSET:
            field_dict["max_sends"] = max_sends
        if until is not UNSET:
            field_dict["until"] = until
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if subject is not UNSET:
            field_dict["subject"] = subject

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _status = d.pop("status", UNSET)
        status: UpdateRepeatingSendRequestStatus | Unset
        if isinstance(_status,  Unset):
            status = UNSET
        else:
            status = UpdateRepeatingSendRequestStatus(_status)




        every_minutes = d.pop("every_minutes", UNSET)

        def _parse_only_if_recipient_idle_minutes(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        only_if_recipient_idle_minutes = _parse_only_if_recipient_idle_minutes(d.pop("only_if_recipient_idle_minutes", UNSET))


        stoppable_by_recipient = d.pop("stoppable_by_recipient", UNSET)

        def _parse_max_sends(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        max_sends = _parse_max_sends(d.pop("max_sends", UNSET))


        def _parse_until(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                until_type_0 = isoparse(data)



                return until_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        until = _parse_until(d.pop("until", UNSET))


        body_text = d.pop("body_text", UNSET)

        subject = d.pop("subject", UNSET)

        update_repeating_send_request = cls(
            status=status,
            every_minutes=every_minutes,
            only_if_recipient_idle_minutes=only_if_recipient_idle_minutes,
            stoppable_by_recipient=stoppable_by_recipient,
            max_sends=max_sends,
            until=until,
            body_text=body_text,
            subject=subject,
        )

        return update_repeating_send_request

