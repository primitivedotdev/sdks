from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SendMailInputHeaders")



@_attrs_define
class SendMailInputHeaders:
    """ Extra headers to set on the message, as `{ "Name": "value" }`. Accepted names: `Auto-Submitted`, `Precedence`,
    `X-Auto-Response-Suppress`, `X-Primitive-Interaction`, `X-Primitive-Interaction-Ref`, and any custom `X-` header
    except the reserved families `X-Primitive-*`, `X-Original-*`, `X-Forwarded-*`, `X-Received`, `X-Spam*`, `X-MS-*`,
    `X-Microsoft-*`, `X-Google-*`, `X-GM-*` and `X-Apple-*`. Names match case-insensitively; an allowlisted name is sent
    in its canonical capitalization and a custom `X-` name with the spelling given. The same name twice (in any case) is
    a `validation_error`, as is any other name. At most 25 headers; names up to 64 characters with no spaces or colon;
    values 1 to 200 printable ASCII characters. Custom headers are not added to the DKIM signature. The headers are
    stored with the send and can be searched with the `header` parameter of `GET /sent-emails`.

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
