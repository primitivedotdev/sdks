from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_search_meta_sort import EmailSearchMetaSort
from typing import cast






T = TypeVar("T", bound="EmailSearchMeta")



@_attrs_define
class EmailSearchMeta:
    """ 
        Attributes:
            total (int): Total number of matching records, capped when `total_capped` is true.
            total_capped (bool): Whether `total` was capped instead of counted exactly.
            limit (int): Page size used for this request.
            cursor (None | str): Cursor for the next search page, or null if no more results.
            sort (EmailSearchMetaSort): Sort mode used for the result page.
     """

    total: int
    total_capped: bool
    limit: int
    cursor: None | str
    sort: EmailSearchMetaSort
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        total = self.total

        total_capped = self.total_capped

        limit = self.limit

        cursor: None | str
        cursor = self.cursor

        sort = self.sort.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "total": total,
            "total_capped": total_capped,
            "limit": limit,
            "cursor": cursor,
            "sort": sort,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        total = d.pop("total")

        total_capped = d.pop("total_capped")

        limit = d.pop("limit")

        def _parse_cursor(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cursor = _parse_cursor(d.pop("cursor"))


        sort = EmailSearchMetaSort(d.pop("sort"))




        email_search_meta = cls(
            total=total,
            total_capped=total_capped,
            limit=limit,
            cursor=cursor,
            sort=sort,
        )


        email_search_meta.additional_properties = d
        return email_search_meta

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
