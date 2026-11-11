from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_mailbox_access_result_entries_item import ListMailboxAccessResultEntriesItem





T = TypeVar("T", bound="ListMailboxAccessResult")



@_attrs_define
class ListMailboxAccessResult:
    """ 
        Attributes:
            entries (list[ListMailboxAccessResultEntriesItem]):
            note (str | Unset): Only with no entries: says where each member's mail access comes from instead.
     """

    entries: list[ListMailboxAccessResultEntriesItem]
    note: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_mailbox_access_result_entries_item import ListMailboxAccessResultEntriesItem # noqa: PLC0415
        entries = []
        for entries_item_data in self.entries:
            entries_item = entries_item_data.to_dict()
            entries.append(entries_item)



        note = self.note


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "entries": entries,
        })
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_mailbox_access_result_entries_item import ListMailboxAccessResultEntriesItem # noqa: PLC0415
        d = dict(src_dict)
        entries = []
        _entries = d.pop("entries")
        for entries_item_data in (_entries):
            entries_item = ListMailboxAccessResultEntriesItem.from_dict(entries_item_data)



            entries.append(entries_item)


        note = d.pop("note", UNSET)

        list_mailbox_access_result = cls(
            entries=entries,
            note=note,
        )


        list_mailbox_access_result.additional_properties = d
        return list_mailbox_access_result

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
