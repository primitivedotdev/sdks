from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="KeyConditionsInput")



@_attrs_define
class KeyConditionsInput:
    """ 
        Attributes:
            ip_allowlist (list[str] | None | Unset): CIDR ranges (IPv4 or IPv6) the key may be used from.
            rate_limit_per_minute (int | None | Unset):
     """

    ip_allowlist: list[str] | None | Unset = UNSET
    rate_limit_per_minute: int | None | Unset = UNSET





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


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if ip_allowlist is not UNSET:
            field_dict["ip_allowlist"] = ip_allowlist
        if rate_limit_per_minute is not UNSET:
            field_dict["rate_limit_per_minute"] = rate_limit_per_minute

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


        key_conditions_input = cls(
            ip_allowlist=ip_allowlist,
            rate_limit_per_minute=rate_limit_per_minute,
        )

        return key_conditions_input

