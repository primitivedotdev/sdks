from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.set_mailbox_access_request_entries_item_principal_kind import SetMailboxAccessRequestEntriesItemPrincipalKind






T = TypeVar("T", bound="SetMailboxAccessRequestEntriesItemPrincipal")



@_attrs_define
class SetMailboxAccessRequestEntriesItemPrincipal:
    """ 
        Attributes:
            kind (SetMailboxAccessRequestEntriesItemPrincipalKind):
            id (str):
     """

    kind: SetMailboxAccessRequestEntriesItemPrincipalKind
    id: str





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        id = self.id


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "id": id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = SetMailboxAccessRequestEntriesItemPrincipalKind(d.pop("kind"))




        id = d.pop("id")

        set_mailbox_access_request_entries_item_principal = cls(
            kind=kind,
            id=id,
        )

        return set_mailbox_access_request_entries_item_principal

