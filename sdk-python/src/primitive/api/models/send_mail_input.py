from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="SendMailInput")



@_attrs_define
class SendMailInput:
    """ 
        Attributes:
            from_ (str): RFC 5322 From header. The sender domain must be a verified outbound domain for your organization.
            to (str): Recipient address. Recipient eligibility depends on your account's outbound entitlements.
            subject (str): Subject line for the outbound message
            body_text (str | Unset): Plain-text message body. At least one of body_text or body_html is required.
            body_html (str | Unset): HTML message body. At least one of body_text or body_html is required.
            in_reply_to (str | Unset): Message-ID of the direct parent email when sending a threaded reply.
            references (list[str] | Unset): Full ordered message-id chain for the thread.
     """

    from_: str
    to: str
    subject: str
    body_text: str | Unset = UNSET
    body_html: str | Unset = UNSET
    in_reply_to: str | Unset = UNSET
    references: list[str] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from_ = self.from_

        to = self.to

        subject = self.subject

        body_text = self.body_text

        body_html = self.body_html

        in_reply_to = self.in_reply_to

        references: list[str] | Unset = UNSET
        if not isinstance(self.references, Unset):
            references = self.references




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from": from_,
            "to": to,
            "subject": subject,
        })
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if body_html is not UNSET:
            field_dict["body_html"] = body_html
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

        body_text = d.pop("body_text", UNSET)

        body_html = d.pop("body_html", UNSET)

        in_reply_to = d.pop("in_reply_to", UNSET)

        references = cast(list[str], d.pop("references", UNSET))


        send_mail_input = cls(
            from_=from_,
            to=to,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            in_reply_to=in_reply_to,
            references=references,
        )

        return send_mail_input

