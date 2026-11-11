from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="EmailListMeta")



@_attrs_define
class EmailListMeta:
    """ 
        Attributes:
            total (int): Total number of matching records
            limit (int): Page size used for this request
            cursor (None | str): Cursor for the next page, or null if no more results
            recipient_outside_access (bool | Unset): Present, as true, when your credential is limited to some mailboxes,
                recipient names one that is neither one of its addresses nor on one of its domains (or the credential reads no
                received mail at all), and it reads through no email rule: the page is then empty however much mail that mailbox
                holds. Absent otherwise, and for an address on one of your domains, which may still list nothing.
            recipient_rules_only (bool | Unset): Present, as true, when your credential is limited to some mailboxes,
                recipient names one that is neither one of its addresses nor on one of its domains, and the credential reads
                some mail through email rules: the page holds only the mail those rules give it there. Absent otherwise.
     """

    total: int
    limit: int
    cursor: None | str
    recipient_outside_access: bool | Unset = UNSET
    recipient_rules_only: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        total = self.total

        limit = self.limit

        cursor: None | str
        cursor = self.cursor

        recipient_outside_access = self.recipient_outside_access

        recipient_rules_only = self.recipient_rules_only


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "total": total,
            "limit": limit,
            "cursor": cursor,
        })
        if recipient_outside_access is not UNSET:
            field_dict["recipient_outside_access"] = recipient_outside_access
        if recipient_rules_only is not UNSET:
            field_dict["recipient_rules_only"] = recipient_rules_only

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        total = d.pop("total")

        limit = d.pop("limit")

        def _parse_cursor(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cursor = _parse_cursor(d.pop("cursor"))


        recipient_outside_access = d.pop("recipient_outside_access", UNSET)

        recipient_rules_only = d.pop("recipient_rules_only", UNSET)

        email_list_meta = cls(
            total=total,
            limit=limit,
            cursor=cursor,
            recipient_outside_access=recipient_outside_access,
            recipient_rules_only=recipient_rules_only,
        )


        email_list_meta.additional_properties = d
        return email_list_meta

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
