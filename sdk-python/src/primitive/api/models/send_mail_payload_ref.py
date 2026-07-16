from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SendMailPayloadRef")



@_attrs_define
class SendMailPayloadRef:
    """ A reference to an already-uploaded Primitive Payloads object, delivered as an attachment without inlining the bytes
    — the way to send an attachment larger than the inline cap. Upload the object via /v1/payloads (with a client-held
    CEK the server never sees), then reference it here.

        Attributes:
            root (str): The 64-char lowercase-hex Merkle root of a finalized payloads object.
            filename (str): Attachment filename presented to the recipient.
            cek (str): Base64url-encoded (unpadded) content-encryption key the recipient uses to decrypt. Travels with the
                email; the object store only ever holds ciphertext.
            content_type (str | Unset): Optional MIME content type.
     """

    root: str
    filename: str
    cek: str
    content_type: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        root = self.root

        filename = self.filename

        cek = self.cek

        content_type = self.content_type


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "root": root,
            "filename": filename,
            "cek": cek,
        })
        if content_type is not UNSET:
            field_dict["content_type"] = content_type

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        root = d.pop("root")

        filename = d.pop("filename")

        cek = d.pop("cek")

        content_type = d.pop("content_type", UNSET)

        send_mail_payload_ref = cls(
            root=root,
            filename=filename,
            cek=cek,
            content_type=content_type,
        )

        return send_mail_payload_ref

