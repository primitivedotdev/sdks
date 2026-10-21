from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.archive_members_format import ArchiveMembersFormat
from typing import cast

if TYPE_CHECKING:
  from ..models.archive_member import ArchiveMember





T = TypeVar("T", bound="ArchiveMembers")



@_attrs_define
class ArchiveMembers:
    """ 
        Attributes:
            part_index (int): The attachment the listing is of.
            filename (None | str): That attachment's filename.
            format_ (ArchiveMembersFormat):
            members (list[ArchiveMember]): Regular files in archive order.
     """

    part_index: int
    filename: None | str
    format_: ArchiveMembersFormat
    members: list[ArchiveMember]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.archive_member import ArchiveMember # noqa: PLC0415
        part_index = self.part_index

        filename: None | str
        filename = self.filename

        format_ = self.format_.value

        members = []
        for members_item_data in self.members:
            members_item = members_item_data.to_dict()
            members.append(members_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "part_index": part_index,
            "filename": filename,
            "format": format_,
            "members": members,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.archive_member import ArchiveMember # noqa: PLC0415
        d = dict(src_dict)
        part_index = d.pop("part_index")

        def _parse_filename(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        filename = _parse_filename(d.pop("filename"))


        format_ = ArchiveMembersFormat(d.pop("format"))




        members = []
        _members = d.pop("members")
        for members_item_data in (_members):
            members_item = ArchiveMember.from_dict(members_item_data)



            members.append(members_item)


        archive_members = cls(
            part_index=part_index,
            filename=filename,
            format_=format_,
            members=members,
        )


        archive_members.additional_properties = d
        return archive_members

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
