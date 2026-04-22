from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SendInput")



@_attrs_define
class SendInput:
    """ 
        Attributes:
            from_ (str): Active sender address on a domain owned by your organization
            to (str): Exact recipient address that previously sent your org an authenticated inbound email
            subject (str): Subject line for the outbound message
            body (str): Plain-text message body. Maximum size is 65536 UTF-8 bytes.
     """

    from_: str
    to: str
    subject: str
    body: str





    def to_dict(self) -> dict[str, Any]:
        from_ = self.from_

        to = self.to

        subject = self.subject

        body = self.body


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from": from_,
            "to": to,
            "subject": subject,
            "body": body,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        from_ = d.pop("from")

        to = d.pop("to")

        subject = d.pop("subject")

        body = d.pop("body")

        send_input = cls(
            from_=from_,
            to=to,
            subject=subject,
            body=body,
        )

        return send_input

