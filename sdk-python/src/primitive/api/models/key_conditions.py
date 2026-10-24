from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="KeyConditions")



@_attrs_define
class KeyConditions:
    """ Conditions every use of the key is checked against.

        Attributes:
            ip_allowlist (list[str] | None | Unset): CIDR ranges (IPv4 or IPv6) the key may be used from.
            rate_limit_per_minute (int | None | Unset):
            suspended_at (datetime.datetime | None | Unset): Set when the key is suspended (read only).
     """

    ip_allowlist: list[str] | None | Unset = UNSET
    rate_limit_per_minute: int | None | Unset = UNSET
    suspended_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        ip_allowlist: list[str] | None | Unset
        if isinstance(self.ip_allowlist, Unset):
            ip_allowlist = UNSET
        elif isinstance(self.ip_allowlist, list):
            ip_allowlist = self.ip_allowlist


        else:
            ip_allowlist = self.ip_allowlist

        rate_limit_per_minute: int | None | Unset
        if isinstance(self.rate_limit_per_minute, Unset):
            rate_limit_per_minute = UNSET
        else:
            rate_limit_per_minute = self.rate_limit_per_minute

        suspended_at: None | str | Unset
        if isinstance(self.suspended_at, Unset):
            suspended_at = UNSET
        elif isinstance(self.suspended_at, datetime.datetime):
            suspended_at = self.suspended_at.isoformat()
        else:
            suspended_at = self.suspended_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if ip_allowlist is not UNSET:
            field_dict["ip_allowlist"] = ip_allowlist
        if rate_limit_per_minute is not UNSET:
            field_dict["rate_limit_per_minute"] = rate_limit_per_minute
        if suspended_at is not UNSET:
            field_dict["suspended_at"] = suspended_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_ip_allowlist(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                ip_allowlist_type_0 = cast(list[str], data)

                return ip_allowlist_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        ip_allowlist = _parse_ip_allowlist(d.pop("ip_allowlist", UNSET))


        def _parse_rate_limit_per_minute(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        rate_limit_per_minute = _parse_rate_limit_per_minute(d.pop("rate_limit_per_minute", UNSET))


        def _parse_suspended_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                suspended_at_type_0 = datetime.datetime.fromisoformat(data)



                return suspended_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        suspended_at = _parse_suspended_at(d.pop("suspended_at", UNSET))


        key_conditions = cls(
            ip_allowlist=ip_allowlist,
            rate_limit_per_minute=rate_limit_per_minute,
            suspended_at=suspended_at,
        )


        key_conditions.additional_properties = d
        return key_conditions

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
