from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="EmailAttachment")



@_attrs_define
class EmailAttachment:
    """ Metadata for one attachment. The bytes are not inline; download
    all attachments for a message as a gzipped tarball via
    `/emails/{id}/attachments.tar.gz`. `sha256` lets you verify a
    specific part after extraction.

        Attributes:
            size_bytes (int):
            filename (None | str | Unset):
            content_type (None | str | Unset):
            sha256 (None | str | Unset):
            part_index (int | Unset): Zero-based index of this part within the message.
     """

    size_bytes: int
    filename: None | str | Unset = UNSET
    content_type: None | str | Unset = UNSET
    sha256: None | str | Unset = UNSET
    part_index: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        size_bytes = self.size_bytes

        filename: None | str | Unset
        if isinstance(self.filename, Unset):
            filename = UNSET
        else:
            filename = self.filename

        content_type: None | str | Unset
        if isinstance(self.content_type, Unset):
            content_type = UNSET
        else:
            content_type = self.content_type

        sha256: None | str | Unset
        if isinstance(self.sha256, Unset):
            sha256 = UNSET
        else:
            sha256 = self.sha256

        part_index = self.part_index


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "size_bytes": size_bytes,
        })
        if filename is not UNSET:
            field_dict["filename"] = filename
        if content_type is not UNSET:
            field_dict["content_type"] = content_type
        if sha256 is not UNSET:
            field_dict["sha256"] = sha256
        if part_index is not UNSET:
            field_dict["part_index"] = part_index

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        size_bytes = d.pop("size_bytes")

        def _parse_filename(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        filename = _parse_filename(d.pop("filename", UNSET))


        def _parse_content_type(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        content_type = _parse_content_type(d.pop("content_type", UNSET))


        def _parse_sha256(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        sha256 = _parse_sha256(d.pop("sha256", UNSET))


        part_index = d.pop("part_index", UNSET)

        email_attachment = cls(
            size_bytes=size_bytes,
            filename=filename,
            content_type=content_type,
            sha256=sha256,
            part_index=part_index,
        )


        email_attachment.additional_properties = d
        return email_attachment

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
