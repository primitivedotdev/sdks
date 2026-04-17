from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="StorageStats")



@_attrs_define
class StorageStats:
    """ 
        Attributes:
            used_bytes (int): Total storage used in bytes
            used_kb (float): Total storage used in kilobytes (1 decimal)
            used_mb (float): Total storage used in megabytes (2 decimals)
            quota_mb (float): Storage quota in megabytes (based on plan)
            percentage (float): Percentage of quota used (1 decimal)
            emails_count (int): Number of stored emails
     """

    used_bytes: int
    used_kb: float
    used_mb: float
    quota_mb: float
    percentage: float
    emails_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        used_bytes = self.used_bytes

        used_kb = self.used_kb

        used_mb = self.used_mb

        quota_mb = self.quota_mb

        percentage = self.percentage

        emails_count = self.emails_count


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

        storage_stats = cls(
            used_bytes=used_bytes,
            used_kb=used_kb,
            used_mb=used_mb,
            quota_mb=quota_mb,
            percentage=percentage,
            emails_count=emails_count,
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
