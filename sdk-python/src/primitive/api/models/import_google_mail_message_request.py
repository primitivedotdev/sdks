from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ImportGoogleMailMessageRequest")



@_attrs_define
class ImportGoogleMailMessageRequest:
    """ 
        Attributes:
            message_id (str):
     """

    message_id: str





    def to_dict(self) -> dict[str, Any]:
        message_id = self.message_id


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "message_id": message_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        message_id = d.pop("message_id")

        import_google_mail_message_request = cls(
            message_id=message_id,
        )

        return import_google_mail_message_request

