from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.mailbox_access_list_entries_item import MailboxAccessListEntriesItem





T = TypeVar("T", bound="MailboxAccessList")



@_attrs_define
class MailboxAccessList:
    """ 
        Attributes:
            entries (list[MailboxAccessListEntriesItem]):
     """

    entries: list[MailboxAccessListEntriesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.mailbox_access_list_entries_item import MailboxAccessListEntriesItem # noqa: PLC0415
        entries = []
        for entries_item_data in self.entries:
            entries_item = entries_item_data.to_dict()
            entries.append(entries_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "entries": entries,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.mailbox_access_list_entries_item import MailboxAccessListEntriesItem # noqa: PLC0415
        d = dict(src_dict)
        entries = []
        _entries = d.pop("entries")
        for entries_item_data in (_entries):
            entries_item = MailboxAccessListEntriesItem.from_dict(entries_item_data)



            entries.append(entries_item)


        mailbox_access_list = cls(
            entries=entries,
        )


        mailbox_access_list.additional_properties = d
        return mailbox_access_list

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
