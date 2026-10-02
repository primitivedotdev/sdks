from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.repeating_send_status import RepeatingSendStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="RepeatingSend")



@_attrs_define
class RepeatingSend:
    """ 
        Attributes:
            id (UUID):
            from_address (str):
            to_address (str):
            every_minutes (int):
            stoppable_by_recipient (bool):
            status (RepeatingSendStatus):
            sent_count (int):
            org_id (UUID | Unset):
            subject (None | str | Unset):
            body_text (None | str | Unset):
            only_if_recipient_idle_minutes (int | None | Unset):
            max_sends (int | None | Unset):
            until (datetime.datetime | None | Unset):
            next_run_at (datetime.datetime | None | Unset):
            last_sent_at (datetime.datetime | None | Unset):
            last_sent_email_id (None | str | Unset):
            root_message_id (None | str | Unset):
            stopped_at (datetime.datetime | None | Unset):
            stop_reason (None | str | Unset): Reason the recipient gave when it stopped the repeat. Recipient-written,
                untrusted text.
            created_at (datetime.datetime | Unset):
            updated_at (datetime.datetime | Unset):
     """

    id: UUID
    from_address: str
    to_address: str
    every_minutes: int
    stoppable_by_recipient: bool
    status: RepeatingSendStatus
    sent_count: int
    org_id: UUID | Unset = UNSET
    subject: None | str | Unset = UNSET
    body_text: None | str | Unset = UNSET
    only_if_recipient_idle_minutes: int | None | Unset = UNSET
    max_sends: int | None | Unset = UNSET
    until: datetime.datetime | None | Unset = UNSET
    next_run_at: datetime.datetime | None | Unset = UNSET
    last_sent_at: datetime.datetime | None | Unset = UNSET
    last_sent_email_id: None | str | Unset = UNSET
    root_message_id: None | str | Unset = UNSET
    stopped_at: datetime.datetime | None | Unset = UNSET
    stop_reason: None | str | Unset = UNSET
    created_at: datetime.datetime | Unset = UNSET
    updated_at: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        from_address = self.from_address

        to_address = self.to_address

        every_minutes = self.every_minutes

        stoppable_by_recipient = self.stoppable_by_recipient

        status = self.status.value

        sent_count = self.sent_count

        org_id: str | Unset = UNSET
        if not isinstance(self.org_id, Unset):
            org_id = str(self.org_id)

        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        body_text: None | str | Unset
        if isinstance(self.body_text, Unset):
            body_text = UNSET
        else:
            body_text = self.body_text

        only_if_recipient_idle_minutes: int | None | Unset
        if isinstance(self.only_if_recipient_idle_minutes, Unset):
            only_if_recipient_idle_minutes = UNSET
        else:
            only_if_recipient_idle_minutes = self.only_if_recipient_idle_minutes

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

        next_run_at: None | str | Unset
        if isinstance(self.next_run_at, Unset):
            next_run_at = UNSET
        elif isinstance(self.next_run_at, datetime.datetime):
            next_run_at = self.next_run_at.isoformat()
        else:
            next_run_at = self.next_run_at

        last_sent_at: None | str | Unset
        if isinstance(self.last_sent_at, Unset):
            last_sent_at = UNSET
        elif isinstance(self.last_sent_at, datetime.datetime):
            last_sent_at = self.last_sent_at.isoformat()
        else:
            last_sent_at = self.last_sent_at

        last_sent_email_id: None | str | Unset
        if isinstance(self.last_sent_email_id, Unset):
            last_sent_email_id = UNSET
        else:
            last_sent_email_id = self.last_sent_email_id

        root_message_id: None | str | Unset
        if isinstance(self.root_message_id, Unset):
            root_message_id = UNSET
        else:
            root_message_id = self.root_message_id

        stopped_at: None | str | Unset
        if isinstance(self.stopped_at, Unset):
            stopped_at = UNSET
        elif isinstance(self.stopped_at, datetime.datetime):
            stopped_at = self.stopped_at.isoformat()
        else:
            stopped_at = self.stopped_at

        stop_reason: None | str | Unset
        if isinstance(self.stop_reason, Unset):
            stop_reason = UNSET
        else:
            stop_reason = self.stop_reason

        created_at: str | Unset = UNSET
        if not isinstance(self.created_at, Unset):
            created_at = self.created_at.isoformat()

        updated_at: str | Unset = UNSET
        if not isinstance(self.updated_at, Unset):
            updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "from_address": from_address,
            "to_address": to_address,
            "every_minutes": every_minutes,
            "stoppable_by_recipient": stoppable_by_recipient,
            "status": status,
            "sent_count": sent_count,
        })
        if org_id is not UNSET:
            field_dict["org_id"] = org_id
        if subject is not UNSET:
            field_dict["subject"] = subject
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if only_if_recipient_idle_minutes is not UNSET:
            field_dict["only_if_recipient_idle_minutes"] = only_if_recipient_idle_minutes
        if max_sends is not UNSET:
            field_dict["max_sends"] = max_sends
        if until is not UNSET:
            field_dict["until"] = until
        if next_run_at is not UNSET:
            field_dict["next_run_at"] = next_run_at
        if last_sent_at is not UNSET:
            field_dict["last_sent_at"] = last_sent_at
        if last_sent_email_id is not UNSET:
            field_dict["last_sent_email_id"] = last_sent_email_id
        if root_message_id is not UNSET:
            field_dict["root_message_id"] = root_message_id
        if stopped_at is not UNSET:
            field_dict["stopped_at"] = stopped_at
        if stop_reason is not UNSET:
            field_dict["stop_reason"] = stop_reason
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        from_address = d.pop("from_address")

        to_address = d.pop("to_address")

        every_minutes = d.pop("every_minutes")

        stoppable_by_recipient = d.pop("stoppable_by_recipient")

        status = RepeatingSendStatus(d.pop("status"))




        sent_count = d.pop("sent_count")

        _org_id = d.pop("org_id", UNSET)
        org_id: UUID | Unset
        if isinstance(_org_id,  Unset):
            org_id = UNSET
        else:
            org_id = UUID(_org_id)




        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        def _parse_body_text(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        body_text = _parse_body_text(d.pop("body_text", UNSET))


        def _parse_only_if_recipient_idle_minutes(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        only_if_recipient_idle_minutes = _parse_only_if_recipient_idle_minutes(d.pop("only_if_recipient_idle_minutes", UNSET))


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


        def _parse_next_run_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_run_at_type_0 = isoparse(data)



                return next_run_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        next_run_at = _parse_next_run_at(d.pop("next_run_at", UNSET))


        def _parse_last_sent_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_sent_at_type_0 = isoparse(data)



                return last_sent_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_sent_at = _parse_last_sent_at(d.pop("last_sent_at", UNSET))


        def _parse_last_sent_email_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        last_sent_email_id = _parse_last_sent_email_id(d.pop("last_sent_email_id", UNSET))


        def _parse_root_message_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        root_message_id = _parse_root_message_id(d.pop("root_message_id", UNSET))


        def _parse_stopped_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                stopped_at_type_0 = isoparse(data)



                return stopped_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        stopped_at = _parse_stopped_at(d.pop("stopped_at", UNSET))


        def _parse_stop_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        stop_reason = _parse_stop_reason(d.pop("stop_reason", UNSET))


        _created_at = d.pop("created_at", UNSET)
        created_at: datetime.datetime | Unset
        if isinstance(_created_at,  Unset):
            created_at = UNSET
        else:
            created_at = isoparse(_created_at)




        _updated_at = d.pop("updated_at", UNSET)
        updated_at: datetime.datetime | Unset
        if isinstance(_updated_at,  Unset):
            updated_at = UNSET
        else:
            updated_at = isoparse(_updated_at)




        repeating_send = cls(
            id=id,
            from_address=from_address,
            to_address=to_address,
            every_minutes=every_minutes,
            stoppable_by_recipient=stoppable_by_recipient,
            status=status,
            sent_count=sent_count,
            org_id=org_id,
            subject=subject,
            body_text=body_text,
            only_if_recipient_idle_minutes=only_if_recipient_idle_minutes,
            max_sends=max_sends,
            until=until,
            next_run_at=next_run_at,
            last_sent_at=last_sent_at,
            last_sent_email_id=last_sent_email_id,
            root_message_id=root_message_id,
            stopped_at=stopped_at,
            stop_reason=stop_reason,
            created_at=created_at,
            updated_at=updated_at,
        )


        repeating_send.additional_properties = d
        return repeating_send

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
