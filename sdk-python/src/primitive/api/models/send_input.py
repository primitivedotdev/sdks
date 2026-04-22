from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="SendInput")



@_attrs_define
class SendInput:
    """ 
        Attributes:
            from_ (str): Active sender address on a domain owned by your organization
            to (str): Exact recipient address that previously sent your org an authenticated inbound email
            subject (str): Subject line for the outbound message
            text (str): Plain-text message body. Maximum size is 65536 UTF-8 bytes.
            in_reply_to (str | Unset): Message-ID of the direct parent email when sending a threaded reply.
            references (list[str] | Unset): Full ordered message-id chain for the thread.
     """

    from_: str
    to: str
    subject: str
    text: str
    in_reply_to: str | Unset = UNSET
    references: list[str] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from_ = self.from_

        to = self.to

        subject = self.subject

        text = self.text

        in_reply_to = self.in_reply_to

        references: list[str] | Unset = UNSET
        if not isinstance(self.references, Unset):
            references = self.references




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from": from_,
            "to": to,
            "subject": subject,
            "text": text,
        })
        if in_reply_to is not UNSET:
            field_dict["in_reply_to"] = in_reply_to
        if references is not UNSET:
            field_dict["references"] = references

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        from_ = d.pop("from")

        to = d.pop("to")

        subject = d.pop("subject")

        text = d.pop("text")

        in_reply_to = d.pop("in_reply_to", UNSET)

        references = cast(list[str], d.pop("references", UNSET))


        send_input = cls(
            from_=from_,
            to=to,
            subject=subject,
            text=text,
            in_reply_to=in_reply_to,
            references=references,
        )

        return send_input

