from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="SentEmailDetailAttachmentsItem")



@_attrs_define
class SentEmailDetailAttachmentsItem:
    """ Metadata for one submitted inline attachment.

        Attributes:
            filename (None | str):
            content_type (str):
            size_bytes (int):
            sha256 (str):
            part_index (int):
            tar_path (str):
     """

    filename: None | str
    content_type: str
    size_bytes: int
    sha256: str
    part_index: int
    tar_path: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        filename: None | str
        filename = self.filename

        content_type = self.content_type

        size_bytes = self.size_bytes

        sha256 = self.sha256

        part_index = self.part_index

        tar_path = self.tar_path


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "filename": filename,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "sha256": sha256,
            "part_index": part_index,
            "tar_path": tar_path,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_filename(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        filename = _parse_filename(d.pop("filename"))


        content_type = d.pop("content_type")

        size_bytes = d.pop("size_bytes")

        sha256 = d.pop("sha256")

        part_index = d.pop("part_index")

        tar_path = d.pop("tar_path")

        sent_email_detail_attachments_item = cls(
            filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            sha256=sha256,
            part_index=part_index,
            tar_path=tar_path,
        )


        sent_email_detail_attachments_item.additional_properties = d
        return sent_email_detail_attachments_item

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
