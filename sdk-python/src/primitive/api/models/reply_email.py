from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ReplyEmail")



@_attrs_define
class ReplyEmail:
    """ A threaded inbound reply to one of the org's sends, keyed by
    the inbound email's `reply_to_sent_email_id`. Compact on
    purpose: enough to read the reply and decide what to do
    next, with `/emails/{id}` available for the fully parsed
    detail.

        Attributes:
            id (UUID): Inbound email row id; usable with `/emails/{id}`.
            thread_id (None | UUID): Conversation thread id; usable with `/threads/{id}`.
            reply_to_sent_email_id (None | UUID): The sent-email id this inbound message replied to.
            from_email (str): Sender of the reply (From header when present, else envelope sender).
            to_email (str): Recipient address the reply arrived at.
            subject (None | str):
            body_text (None | str): Plain-text body of the reply, when present.
            body_html (None | str): HTML body of the reply, when present.
            received_at (datetime.datetime | None):
            status (str): Inbound processing status of the reply row. Typically an
                `EmailStatus` value, but left as an open string here to
                match the server contract, which does not narrow it.
     """

    id: UUID
    thread_id: None | UUID
    reply_to_sent_email_id: None | UUID
    from_email: str
    to_email: str
    subject: None | str
    body_text: None | str
    body_html: None | str
    received_at: datetime.datetime | None
    status: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        thread_id: None | str
        if isinstance(self.thread_id, UUID):
            thread_id = str(self.thread_id)
        else:
            thread_id = self.thread_id

        reply_to_sent_email_id: None | str
        if isinstance(self.reply_to_sent_email_id, UUID):
            reply_to_sent_email_id = str(self.reply_to_sent_email_id)
        else:
            reply_to_sent_email_id = self.reply_to_sent_email_id

        from_email = self.from_email

        to_email = self.to_email

        subject: None | str
        subject = self.subject

        body_text: None | str
        body_text = self.body_text

        body_html: None | str
        body_html = self.body_html

        received_at: None | str
        if isinstance(self.received_at, datetime.datetime):
            received_at = self.received_at.isoformat()
        else:
            received_at = self.received_at

        status = self.status


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "thread_id": thread_id,
            "reply_to_sent_email_id": reply_to_sent_email_id,
            "from_email": from_email,
            "to_email": to_email,
            "subject": subject,
            "body_text": body_text,
            "body_html": body_html,
            "received_at": received_at,
            "status": status,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_thread_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                thread_id_type_0 = UUID(data)



                return thread_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        thread_id = _parse_thread_id(d.pop("thread_id"))


        def _parse_reply_to_sent_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                reply_to_sent_email_id_type_0 = UUID(data)



                return reply_to_sent_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        reply_to_sent_email_id = _parse_reply_to_sent_email_id(d.pop("reply_to_sent_email_id"))


        from_email = d.pop("from_email")

        to_email = d.pop("to_email")

        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))


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


        def _parse_received_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                received_at_type_0 = isoparse(data)



                return received_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        received_at = _parse_received_at(d.pop("received_at"))


        status = d.pop("status")

        reply_email = cls(
            id=id,
            thread_id=thread_id,
            reply_to_sent_email_id=reply_to_sent_email_id,
            from_email=from_email,
            to_email=to_email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            received_at=received_at,
            status=status,
        )


        reply_email.additional_properties = d
        return reply_email

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
