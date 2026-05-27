from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.conversation_message_direction import ConversationMessageDirection
from ..models.conversation_message_role import ConversationMessageRole
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ConversationMessage")



@_attrs_define
class ConversationMessage:
    """ One message in the conversation, with its body and a chat role.

        Attributes:
            role (ConversationMessageRole): Chat role derived from `direction`: `user` for inbound
                (received) messages, `assistant` for outbound (your own prior
                replies). Lets `messages` be passed directly to a chat model.
            direction (ConversationMessageDirection): `inbound` for a received email (`/emails/{id}`), `outbound`
                for a send (`/sent-emails/{id}`).
            id (UUID):
            text (str): Plain-text body. Empty string when the message has no text
                part or its content was discarded by retention.
            message_id (None | str | Unset):
            from_ (None | str | Unset):
            to (None | str | Unset):
            subject (None | str | Unset):
            timestamp (datetime.datetime | None | Unset): received_at for inbound, created_at for outbound.
     """

    role: ConversationMessageRole
    direction: ConversationMessageDirection
    id: UUID
    text: str
    message_id: None | str | Unset = UNSET
    from_: None | str | Unset = UNSET
    to: None | str | Unset = UNSET
    subject: None | str | Unset = UNSET
    timestamp: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        role = self.role.value

        direction = self.direction.value

        id = str(self.id)

        text = self.text

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

        timestamp: None | str | Unset
        if isinstance(self.timestamp, Unset):
            timestamp = UNSET
        elif isinstance(self.timestamp, datetime.datetime):
            timestamp = self.timestamp.isoformat()
        else:
            timestamp = self.timestamp


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "role": role,
            "direction": direction,
            "id": id,
            "text": text,
        })
        if message_id is not UNSET:
            field_dict["message_id"] = message_id
        if from_ is not UNSET:
            field_dict["from"] = from_
        if to is not UNSET:
            field_dict["to"] = to
        if subject is not UNSET:
            field_dict["subject"] = subject
        if timestamp is not UNSET:
            field_dict["timestamp"] = timestamp

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        role = ConversationMessageRole(d.pop("role"))




        direction = ConversationMessageDirection(d.pop("direction"))




        id = UUID(d.pop("id"))




        text = d.pop("text")

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


        conversation_message = cls(
            role=role,
            direction=direction,
            id=id,
            text=text,
            message_id=message_id,
            from_=from_,
            to=to,
            subject=subject,
            timestamp=timestamp,
        )


        conversation_message.additional_properties = d
        return conversation_message

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
