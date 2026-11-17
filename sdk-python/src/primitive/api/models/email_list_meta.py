from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="EmailListMeta")



@_attrs_define
class EmailListMeta:
    """ 
        Attributes:
            limit (int): Page size used for this request
            cursor (None | str): Cursor for the next page, or null if no more results
            total (int | Unset): Total number of matching records. Absent when a history page is read with `count=false` (no
                count runs), or when the count does not fit its time budget (`total_unavailable` is then true). `has_more` still
                says whether another page follows.
            recipient_outside_access (bool | Unset): Present, as true, when your credential is limited to some mailboxes,
                recipient names one that is neither one of its addresses nor on one of its domains (or the credential reads no
                received mail at all), and it reads through no email rule: the page is then empty however much mail that mailbox
                holds. Absent otherwise, and for an address on one of your domains, which may still list nothing.
            recipient_rules_only (bool | Unset): Present, as true, when your credential is limited to some mailboxes,
                recipient names one that is neither one of its addresses nor on one of its domains, and the credential reads
                some mail through email rules: the page holds only the mail those rules give it there. Absent otherwise.
            has_more (bool | Unset): Whether another page follows this one, read from the page itself, so it is there with
                or without a count (`count=false`).
            total_capped (bool | Unset): Present whenever `total` is. `true` when the count stopped at its cap, so `total`
                is a floor ("at least N") rather than an exact count. On the forward tail (`since`) and with `search`, no count
                runs: `total` is the rows the page read, and `true` means it saw a match past its last row, so more follow
                `meta.cursor` (`total` is then `limit` + 1, a floor).
            total_unavailable (bool | Unset): Present and `true` when a history page asked for a count that did not fit its
                time budget. The page and `meta.cursor` are still returned; only `total` and `total_capped` are absent.
                `has_more` still says whether another page follows.
            domain_ids (list[UUID] | Unset): Present when the request filtered by `domain_ids`: the ids it was given,
                deduped and lowercased.
     """

    limit: int
    cursor: None | str
    total: int | Unset = UNSET
    recipient_outside_access: bool | Unset = UNSET
    recipient_rules_only: bool | Unset = UNSET
    has_more: bool | Unset = UNSET
    total_capped: bool | Unset = UNSET
    total_unavailable: bool | Unset = UNSET
    domain_ids: list[UUID] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        limit = self.limit

        cursor: None | str
        cursor = self.cursor

        total = self.total

        recipient_outside_access = self.recipient_outside_access

        recipient_rules_only = self.recipient_rules_only

        has_more = self.has_more

        total_capped = self.total_capped

        total_unavailable = self.total_unavailable

        domain_ids: list[str] | Unset = UNSET
        if not isinstance(self.domain_ids, Unset):
            domain_ids = []
            for domain_ids_item_data in self.domain_ids:
                domain_ids_item = str(domain_ids_item_data)
                domain_ids.append(domain_ids_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "limit": limit,
            "cursor": cursor,
        })
        if total is not UNSET:
            field_dict["total"] = total
        if recipient_outside_access is not UNSET:
            field_dict["recipient_outside_access"] = recipient_outside_access
        if recipient_rules_only is not UNSET:
            field_dict["recipient_rules_only"] = recipient_rules_only
        if has_more is not UNSET:
            field_dict["has_more"] = has_more
        if total_capped is not UNSET:
            field_dict["total_capped"] = total_capped
        if total_unavailable is not UNSET:
            field_dict["total_unavailable"] = total_unavailable
        if domain_ids is not UNSET:
            field_dict["domain_ids"] = domain_ids

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        limit = d.pop("limit")

        def _parse_cursor(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cursor = _parse_cursor(d.pop("cursor"))


        total = d.pop("total", UNSET)

        recipient_outside_access = d.pop("recipient_outside_access", UNSET)

        recipient_rules_only = d.pop("recipient_rules_only", UNSET)

        has_more = d.pop("has_more", UNSET)

        total_capped = d.pop("total_capped", UNSET)

        total_unavailable = d.pop("total_unavailable", UNSET)

        _domain_ids = d.pop("domain_ids", UNSET)
        domain_ids: list[UUID] | Unset = UNSET
        if _domain_ids is not UNSET:
            domain_ids = []
            for domain_ids_item_data in _domain_ids:
                domain_ids_item = UUID(domain_ids_item_data)



                domain_ids.append(domain_ids_item)


        email_list_meta = cls(
            limit=limit,
            cursor=cursor,
            total=total,
            recipient_outside_access=recipient_outside_access,
            recipient_rules_only=recipient_rules_only,
            has_more=has_more,
            total_capped=total_capped,
            total_unavailable=total_unavailable,
            domain_ids=domain_ids,
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
