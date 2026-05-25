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
     """

    filename: str
    content_base64: str
    content_type: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        filename = self.filename

        content_base64 = self.content_base64

        content_type = self.content_type


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "filename": filename,
            "content_base64": content_base64,
        })
        if content_type is not UNSET:
            field_dict["content_type"] = content_type

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        filename = d.pop("filename")

        content_base64 = d.pop("content_base64")

        content_type = d.pop("content_type", UNSET)

        send_mail_attachment = cls(
            filename=filename,
            content_base64=content_base64,
            content_type=content_type,
        )

        return send_mail_attachment

