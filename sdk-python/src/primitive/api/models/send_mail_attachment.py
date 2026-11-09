from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SendMailAttachment")



@_attrs_define
class SendMailAttachment:
    """ 
        Attributes:
            filename (str): Attachment filename. Control characters are rejected.
            content_base64 (str): Base64-encoded attachment bytes.
            content_type (str | Unset): Optional MIME content type. Control characters are rejected.
            content_id (str | Unset): Content-ID for an inline attachment, without angle brackets. When set the part is sent
                inline so an HTML body can reference it as `cid:<content_id>`. Printable ASCII with no whitespace and no `<` or
                `>`.
     """

    filename: str
    content_base64: str
    content_type: str | Unset = UNSET
    content_id: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        filename = self.filename

        content_base64 = self.content_base64

        content_type = self.content_type

        content_id = self.content_id


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "filename": filename,
            "content_base64": content_base64,
        })
        if content_type is not UNSET:
            field_dict["content_type"] = content_type
        if content_id is not UNSET:
            field_dict["content_id"] = content_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        filename = d.pop("filename")

        content_base64 = d.pop("content_base64")

        content_type = d.pop("content_type", UNSET)

        content_id = d.pop("content_id", UNSET)

        send_mail_attachment = cls(
            filename=filename,
            content_base64=content_base64,
            content_type=content_type,
            content_id=content_id,
        )

        return send_mail_attachment

