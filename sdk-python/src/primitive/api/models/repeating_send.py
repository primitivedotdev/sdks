from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.repeating_send_status import RepeatingSendStatus
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="RepeatingSend")



@_attrs_define
class RepeatingSend:
    """ 
        Attributes:
            id (UUID):
            org_id (UUID):
            from_address (str):
            to_address (str):
            subject (str):
            body_text (None | str):
            body_html (None | str):
            every_minutes (int):
            only_if_recipient_idle_minutes (int | None):
            stoppable_by_recipient (bool):
            max_sends (int | None):
            until (datetime.datetime | None):
            status (RepeatingSendStatus):
            next_run_at (datetime.datetime | None):
            sent_count (int):
            last_sent_at (datetime.datetime | None):
            last_sent_email_id (None | UUID):
            root_message_id (None | str):
            stopped_at (datetime.datetime | None):
            stop_reason (None | str): Reason the recipient gave when it stopped the repeat. Recipient-written, untrusted
                text.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    org_id: UUID
    from_address: str
    to_address: str
    subject: str
    body_text: None | str
    body_html: None | str
    every_minutes: int
    only_if_recipient_idle_minutes: int | None
    stoppable_by_recipient: bool
    max_sends: int | None
    until: datetime.datetime | None
    status: RepeatingSendStatus
    next_run_at: datetime.datetime | None
    sent_count: int
    last_sent_at: datetime.datetime | None
    last_sent_email_id: None | UUID
    root_message_id: None | str
    stopped_at: datetime.datetime | None
    stop_reason: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        org_id = str(self.org_id)

        from_address = self.from_address

        to_address = self.to_address

        subject = self.subject

        body_text: None | str
        body_text = self.body_text

        body_html: None | str
        body_html = self.body_html

        every_minutes = self.every_minutes

        only_if_recipient_idle_minutes: int | None
        only_if_recipient_idle_minutes = self.only_if_recipient_idle_minutes

        stoppable_by_recipient = self.stoppable_by_recipient

        max_sends: int | None
        max_sends = self.max_sends

        until: None | str
        if isinstance(self.until, datetime.datetime):
            until = self.until.isoformat()
        else:
            until = self.until

        status = self.status.value

        next_run_at: None | str
        if isinstance(self.next_run_at, datetime.datetime):
            next_run_at = self.next_run_at.isoformat()
        else:
            next_run_at = self.next_run_at

        sent_count = self.sent_count

        last_sent_at: None | str
        if isinstance(self.last_sent_at, datetime.datetime):
            last_sent_at = self.last_sent_at.isoformat()
        else:
            last_sent_at = self.last_sent_at

        last_sent_email_id: None | str
        if isinstance(self.last_sent_email_id, UUID):
            last_sent_email_id = str(self.last_sent_email_id)
        else:
            last_sent_email_id = self.last_sent_email_id

        root_message_id: None | str
        root_message_id = self.root_message_id

        stopped_at: None | str
        if isinstance(self.stopped_at, datetime.datetime):
            stopped_at = self.stopped_at.isoformat()
        else:
            stopped_at = self.stopped_at

        stop_reason: None | str
        stop_reason = self.stop_reason

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "org_id": org_id,
            "from_address": from_address,
            "to_address": to_address,
            "subject": subject,
            "body_text": body_text,
            "body_html": body_html,
            "every_minutes": every_minutes,
            "only_if_recipient_idle_minutes": only_if_recipient_idle_minutes,
            "stoppable_by_recipient": stoppable_by_recipient,
            "max_sends": max_sends,
            "until": until,
            "status": status,
            "next_run_at": next_run_at,
            "sent_count": sent_count,
            "last_sent_at": last_sent_at,
            "last_sent_email_id": last_sent_email_id,
            "root_message_id": root_message_id,
            "stopped_at": stopped_at,
            "stop_reason": stop_reason,
            "created_at": created_at,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        org_id = UUID(d.pop("org_id"))




        from_address = d.pop("from_address")

        to_address = d.pop("to_address")

        subject = d.pop("subject")

        def _parse_body_text(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        body_text = _parse_body_text(d.pop("body_text"))


        def _parse_body_html(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        body_html = _parse_body_html(d.pop("body_html"))


        every_minutes = d.pop("every_minutes")

        def _parse_only_if_recipient_idle_minutes(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        only_if_recipient_idle_minutes = _parse_only_if_recipient_idle_minutes(d.pop("only_if_recipient_idle_minutes"))


        stoppable_by_recipient = d.pop("stoppable_by_recipient")

        def _parse_max_sends(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        max_sends = _parse_max_sends(d.pop("max_sends"))


        def _parse_until(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                until_type_0 = datetime.datetime.fromisoformat(data)



                return until_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        until = _parse_until(d.pop("until"))


        status = RepeatingSendStatus(d.pop("status"))




        def _parse_next_run_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_run_at_type_0 = datetime.datetime.fromisoformat(data)



                return next_run_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        next_run_at = _parse_next_run_at(d.pop("next_run_at"))


        sent_count = d.pop("sent_count")

        def _parse_last_sent_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_sent_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_sent_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_sent_at = _parse_last_sent_at(d.pop("last_sent_at"))


        def _parse_last_sent_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_sent_email_id_type_0 = UUID(data)



                return last_sent_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        last_sent_email_id = _parse_last_sent_email_id(d.pop("last_sent_email_id"))


        def _parse_root_message_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        root_message_id = _parse_root_message_id(d.pop("root_message_id"))


        def _parse_stopped_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                stopped_at_type_0 = datetime.datetime.fromisoformat(data)



                return stopped_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        stopped_at = _parse_stopped_at(d.pop("stopped_at"))


        def _parse_stop_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        stop_reason = _parse_stop_reason(d.pop("stop_reason"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        repeating_send = cls(
            id=id,
            org_id=org_id,
            from_address=from_address,
            to_address=to_address,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            every_minutes=every_minutes,
            only_if_recipient_idle_minutes=only_if_recipient_idle_minutes,
            stoppable_by_recipient=stoppable_by_recipient,
            max_sends=max_sends,
            until=until,
            status=status,
            next_run_at=next_run_at,
            sent_count=sent_count,
            last_sent_at=last_sent_at,
            last_sent_email_id=last_sent_email_id,
            root_message_id=root_message_id,
            stopped_at=stopped_at,
            stop_reason=stop_reason,
            created_at=created_at,
            updated_at=updated_at,
        )

        return repeating_send

