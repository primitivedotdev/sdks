from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.set_own_mailbox_access_request_entries_item import SetOwnMailboxAccessRequestEntriesItem





T = TypeVar("T", bound="SetOwnMailboxAccessRequest")



@_attrs_define
class SetOwnMailboxAccessRequest:
    """ 
        Attributes:
            entries (list[SetOwnMailboxAccessRequestEntriesItem]):
     """

    entries: list[SetOwnMailboxAccessRequestEntriesItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.set_own_mailbox_access_request_entries_item import SetOwnMailboxAccessRequestEntriesItem # noqa: PLC0415
        entries = []
        for entries_item_data in self.entries:
            entries_item = entries_item_data.to_dict()
            entries.append(entries_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "entries": entries,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.set_own_mailbox_access_request_entries_item import SetOwnMailboxAccessRequestEntriesItem # noqa: PLC0415
        d = dict(src_dict)
        entries = []
        _entries = d.pop("entries")
        for entries_item_data in (_entries):
            entries_item = SetOwnMailboxAccessRequestEntriesItem.from_dict(entries_item_data)



            entries.append(entries_item)


        set_own_mailbox_access_request = cls(
            entries=entries,
        )

        return set_own_mailbox_access_request

