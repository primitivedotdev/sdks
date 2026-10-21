from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SendMailInputHeaders")



@_attrs_define
class SendMailInputHeaders:
    """ Extra headers, as `{ "Name": "value" }`, at most 25. A name is one of `Auto-Submitted`, `Precedence`, `X-Auto-
    Response-Suppress`, `X-Primitive-Interaction`, `X-Primitive-Interaction-Ref`, or a custom `X-` name of letters,
    digits and hyphens that is not credential-like (a word such as `auth`, `token`, `key`, `secret`, `session` or
    `bearer`, joined forms included) and not in a reserved family: X-Primitive*, X-Original-*, X-Originating-*,
    X-Forwarded-*, X-Received*, X-Authenticated*, X-Envelope-*, X-Delivered-To, X-Apparently-To, X-Failed-Recipients,
    X-Loop, X-Priority, X-MSMail-*, X-MS-*, X-Microsoft-*, X-Forefront-*, X-Exchange-*, X-Google-*, X-GM-*, X-Apple-*,
    X-Yahoo-*, X-YMail-*, X-AOL-*, X-Spam*, X-Virus-*, X-Proofpoint-*, X-Barracuda-*, X-Rspamd-*, X-Mimecast-*,
    X-IronPort-*, X-Sophos-*, X-Report-Abuse*, X-CSA-*. Names compare case-insensitively (`_` and `.` count as `-` for
    families); a repeated or any other name is a `validation_error`. Values: 1 to 200 printable ASCII characters. Custom
    headers are sent as spelled, are not DKIM-signed, and can be searched with `header` on `GET /sent-emails`.

        Example:
            {'X-Campaign-Id': 'spring-sale', 'Auto-Submitted': 'auto-generated'}

     """

    additional_properties: dict[str, str] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        
        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        send_mail_input_headers = cls(
        )


        send_mail_input_headers.additional_properties = d
        return send_mail_input_headers

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> str:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: str) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
