from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="StorageStats")



@_attrs_define
class StorageStats:
    """ 
        Attributes:
            used_bytes (int): Total storage used in bytes
            used_kb (float): Total storage used in kilobytes (1 decimal)
            used_mb (float): Total storage used in megabytes (2 decimals)
            quota_mb (float): The plan's included storage in megabytes, the same value as included_mb. It is an allowance,
                not a limit; see limit_mb.
            percentage (float): Storage used as a percentage of the included storage (1 decimal). Can exceed 100.
            emails_count (int): Number of stored emails
            included_mb (float | Unset): Storage included with the plan, in megabytes.
            limit_mb (float | None | Unset): Storage in megabytes past which inbound email is refused. Null when inbound
                email is never refused for storage.
            overage_mb (float | Unset): Storage past included_mb, in megabytes, counting stored email and the search index.
            search_index_bytes (int | Unset): Storage attributed to the semantic search index, in bytes. Counted toward
                included_mb and overage_mb, never toward limit_mb.
     """

    used_bytes: int
    used_kb: float
    used_mb: float
    quota_mb: float
    percentage: float
    emails_count: int
    included_mb: float | Unset = UNSET
    limit_mb: float | None | Unset = UNSET
    overage_mb: float | Unset = UNSET
    search_index_bytes: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        used_bytes = self.used_bytes

        used_kb = self.used_kb

        used_mb = self.used_mb

        quota_mb = self.quota_mb

        percentage = self.percentage

        emails_count = self.emails_count

        included_mb = self.included_mb

        limit_mb: float | None | Unset
        if isinstance(self.limit_mb, Unset):
            limit_mb = UNSET
        else:
            limit_mb = self.limit_mb

        overage_mb = self.overage_mb

        search_index_bytes = self.search_index_bytes


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "used_bytes": used_bytes,
            "used_kb": used_kb,
            "used_mb": used_mb,
            "quota_mb": quota_mb,
            "percentage": percentage,
            "emails_count": emails_count,
        })
        if included_mb is not UNSET:
            field_dict["included_mb"] = included_mb
        if limit_mb is not UNSET:
            field_dict["limit_mb"] = limit_mb
        if overage_mb is not UNSET:
            field_dict["overage_mb"] = overage_mb
        if search_index_bytes is not UNSET:
            field_dict["search_index_bytes"] = search_index_bytes

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        used_bytes = d.pop("used_bytes")

        used_kb = d.pop("used_kb")

        used_mb = d.pop("used_mb")

        quota_mb = d.pop("quota_mb")

        percentage = d.pop("percentage")

        emails_count = d.pop("emails_count")

        included_mb = d.pop("included_mb", UNSET)

        def _parse_limit_mb(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        limit_mb = _parse_limit_mb(d.pop("limit_mb", UNSET))


        overage_mb = d.pop("overage_mb", UNSET)

        search_index_bytes = d.pop("search_index_bytes", UNSET)

        storage_stats = cls(
            used_bytes=used_bytes,
            used_kb=used_kb,
            used_mb=used_mb,
            quota_mb=quota_mb,
            percentage=percentage,
            emails_count=emails_count,
            included_mb=included_mb,
            limit_mb=limit_mb,
            overage_mb=overage_mb,
            search_index_bytes=search_index_bytes,
        )


        storage_stats.additional_properties = d
        return storage_stats

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
