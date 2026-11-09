from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="EmailReadableAttachment")



@_attrs_define
class EmailReadableAttachment:
    """ One attached file. Download it with `GET /emails/{id}/attachments/{part_index}`.

        Attributes:
            filename (None | str): The name the sender gave it, if any.
            content_type (None | str): The declared media type, such as `application/pdf`.
            size_bytes (int | None): Size of the decoded file.
            part_index (int | None): Its position among the attachments.
     """

    filename: None | str
    content_type: None | str
    size_bytes: int | None
    part_index: int | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        filename: None | str
        filename = self.filename

        content_type: None | str
        content_type = self.content_type

        size_bytes: int | None
        size_bytes = self.size_bytes

        part_index: int | None
        part_index = self.part_index


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "filename": filename,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "part_index": part_index,
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


        def _parse_content_type(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        content_type = _parse_content_type(d.pop("content_type"))


        def _parse_size_bytes(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        size_bytes = _parse_size_bytes(d.pop("size_bytes"))


        def _parse_part_index(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        part_index = _parse_part_index(d.pop("part_index"))


        email_readable_attachment = cls(
            filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            part_index=part_index,
        )


        email_readable_attachment.additional_properties = d
        return email_readable_attachment

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
