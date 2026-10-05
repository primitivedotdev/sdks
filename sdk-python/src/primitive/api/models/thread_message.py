from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.thread_message_direction import ThreadMessageDirection
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.thread_message_repeat_type_0 import ThreadMessageRepeatType0
  from ..models.thread_message_sender_member_type_0 import ThreadMessageSenderMemberType0





T = TypeVar("T", bound="ThreadMessage")



@_attrs_define
class ThreadMessage:
    """ One message in a thread (inbound or outbound).

        Attributes:
            direction (ThreadMessageDirection): `inbound` for a received email (`/emails/{id}`), `outbound`
                for a send (`/sent-emails/{id}`). Use it with `id` to fetch
                full content from the right endpoint.
            id (UUID):
            message_id (None | str | Unset):
            from_ (None | str | Unset):
            to (None | str | Unset):
            subject (None | str | Unset):
            status (None | str | Unset): Lifecycle status (an EmailStatus or SentEmailStatus value, per `direction`).
            timestamp (datetime.datetime | None | Unset): received_at for inbound, created_at for outbound.
            repeat (None | ThreadMessageRepeatType0 | Unset): Set when Primitive sent this message as part of a repeating
                send. Resolved from Primitive's own records, never from the message content. Null on every other message and on
                servers that predate repeating sends.
            sender_member (None | ThreadMessageSenderMemberType0 | Unset): Verified human authorship, projected only within
                the member organization. Historical attribution is not current sending or owner authority.
            fyi (bool | Unset): Outbound messages only. True when the send was an informational signal (a read, working or
                typing signal, or an acknowledgement) and nothing else, so it is not a reply that takes part in the
                conversation. Absent on inbound messages. Older servers omit it.
            interaction_hint (str | Unset): Outbound messages only. How to place this send in a timeline: `status` (a pure
                status signal), `card` or `none`. Not declared as a closed enum so that a value added later does not fail
                decoding; treat an unknown value as `none`. Absent on inbound messages. Older servers omit it.
     """

    direction: ThreadMessageDirection
    id: UUID
    message_id: None | str | Unset = UNSET
    from_: None | str | Unset = UNSET
    to: None | str | Unset = UNSET
    subject: None | str | Unset = UNSET
    status: None | str | Unset = UNSET
    timestamp: datetime.datetime | None | Unset = UNSET
    repeat: None | ThreadMessageRepeatType0 | Unset = UNSET
    sender_member: None | ThreadMessageSenderMemberType0 | Unset = UNSET
    fyi: bool | Unset = UNSET
    interaction_hint: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.thread_message_repeat_type_0 import ThreadMessageRepeatType0
        from ..models.thread_message_sender_member_type_0 import ThreadMessageSenderMemberType0
        direction = self.direction.value

        id = str(self.id)

        message_id: None | str | Unset
        if isinstance(self.message_id, Unset):
            message_id = UNSET
        else:
            message_id = self.message_id

        from_: None | str | Unset
        if isinstance(self.from_, Unset):
            from_ = UNSET
        else:
            from_ = self.from_

        to: None | str | Unset
        if isinstance(self.to, Unset):
            to = UNSET
        else:
            to = self.to

        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        status: None | str | Unset
        if isinstance(self.status, Unset):
            status = UNSET
        else:
            status = self.status

        timestamp: None | str | Unset
        if isinstance(self.timestamp, Unset):
            timestamp = UNSET
        elif isinstance(self.timestamp, datetime.datetime):
            timestamp = self.timestamp.isoformat()
        else:
            timestamp = self.timestamp

        repeat: dict[str, Any] | None | Unset
        if isinstance(self.repeat, Unset):
            repeat = UNSET
        elif isinstance(self.repeat, ThreadMessageRepeatType0):
            repeat = self.repeat.to_dict()
        else:
            repeat = self.repeat

        sender_member: dict[str, Any] | None | Unset
        if isinstance(self.sender_member, Unset):
            sender_member = UNSET
        elif isinstance(self.sender_member, ThreadMessageSenderMemberType0):
            sender_member = self.sender_member.to_dict()
        else:
            sender_member = self.sender_member

        fyi = self.fyi

        interaction_hint = self.interaction_hint


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "direction": direction,
            "id": id,
        })
        if message_id is not UNSET:
            field_dict["message_id"] = message_id
        if from_ is not UNSET:
            field_dict["from"] = from_
        if to is not UNSET:
            field_dict["to"] = to
        if subject is not UNSET:
            field_dict["subject"] = subject
        if status is not UNSET:
            field_dict["status"] = status
        if timestamp is not UNSET:
            field_dict["timestamp"] = timestamp
        if repeat is not UNSET:
            field_dict["repeat"] = repeat
        if sender_member is not UNSET:
            field_dict["sender_member"] = sender_member
        if fyi is not UNSET:
            field_dict["fyi"] = fyi
        if interaction_hint is not UNSET:
            field_dict["interaction_hint"] = interaction_hint

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.thread_message_repeat_type_0 import ThreadMessageRepeatType0
        from ..models.thread_message_sender_member_type_0 import ThreadMessageSenderMemberType0
        d = dict(src_dict)
        direction = ThreadMessageDirection(d.pop("direction"))




        id = UUID(d.pop("id"))




        def _parse_message_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message_id = _parse_message_id(d.pop("message_id", UNSET))


        def _parse_from_(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        from_ = _parse_from_(d.pop("from", UNSET))


        def _parse_to(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        to = _parse_to(d.pop("to", UNSET))


        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        def _parse_status(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        status = _parse_status(d.pop("status", UNSET))


        def _parse_timestamp(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                timestamp_type_0 = isoparse(data)



                return timestamp_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        timestamp = _parse_timestamp(d.pop("timestamp", UNSET))


        def _parse_repeat(data: object) -> None | ThreadMessageRepeatType0 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                repeat_type_0 = ThreadMessageRepeatType0.from_dict(data)



                return repeat_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ThreadMessageRepeatType0 | Unset, data)

        repeat = _parse_repeat(d.pop("repeat", UNSET))


        def _parse_sender_member(data: object) -> None | ThreadMessageSenderMemberType0 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                sender_member_type_0 = ThreadMessageSenderMemberType0.from_dict(data)



                return sender_member_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ThreadMessageSenderMemberType0 | Unset, data)

        sender_member = _parse_sender_member(d.pop("sender_member", UNSET))


        fyi = d.pop("fyi", UNSET)

        interaction_hint = d.pop("interaction_hint", UNSET)

        thread_message = cls(
            direction=direction,
            id=id,
            message_id=message_id,
            from_=from_,
            to=to,
            subject=subject,
            status=status,
            timestamp=timestamp,
            repeat=repeat,
            sender_member=sender_member,
            fyi=fyi,
            interaction_hint=interaction_hint,
        )


        thread_message.additional_properties = d
        return thread_message

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
