from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="CredentialsListCredentialsResultItemsItemConditionsType0")



@_attrs_define
class CredentialsListCredentialsResultItemsItemConditionsType0:
    """ 
        Attributes:
            ip_allowlist (list[str] | None):
            rate_limit_per_minute (float | None):
            suspended_at (datetime.datetime | None):
     """

    ip_allowlist: list[str] | None
    rate_limit_per_minute: float | None
    suspended_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        ip_allowlist: list[str] | None
        if isinstance(self.ip_allowlist, list):
            ip_allowlist = self.ip_allowlist


        else:
            ip_allowlist = self.ip_allowlist

        rate_limit_per_minute: float | None
        rate_limit_per_minute = self.rate_limit_per_minute

        suspended_at: None | str
        if isinstance(self.suspended_at, datetime.datetime):
            suspended_at = self.suspended_at.isoformat()
        else:
            suspended_at = self.suspended_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "ip_allowlist": ip_allowlist,
            "rate_limit_per_minute": rate_limit_per_minute,
            "suspended_at": suspended_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_ip_allowlist(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                ip_allowlist_type_0 = cast(list[str], data)

                return ip_allowlist_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        ip_allowlist = _parse_ip_allowlist(d.pop("ip_allowlist"))


        def _parse_rate_limit_per_minute(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        rate_limit_per_minute = _parse_rate_limit_per_minute(d.pop("rate_limit_per_minute"))


        def _parse_suspended_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                suspended_at_type_0 = datetime.datetime.fromisoformat(data)



                return suspended_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        suspended_at = _parse_suspended_at(d.pop("suspended_at"))


        credentials_list_credentials_result_items_item_conditions_type_0 = cls(
            ip_allowlist=ip_allowlist,
            rate_limit_per_minute=rate_limit_per_minute,
            suspended_at=suspended_at,
        )


        credentials_list_credentials_result_items_item_conditions_type_0.additional_properties = d
        return credentials_list_credentials_result_items_item_conditions_type_0

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
