from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="InboxStatusEndpoints")



@_attrs_define
class InboxStatusEndpoints:
    """ 
        Attributes:
            total (int):
            enabled (int):
            disabled (int):
            fallback_enabled (int):
            domain_scoped_enabled (int):
            http_enabled (int):
            function_enabled (int):
     """

    total: int
    enabled: int
    disabled: int
    fallback_enabled: int
    domain_scoped_enabled: int
    http_enabled: int
    function_enabled: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        total = self.total

        enabled = self.enabled

        disabled = self.disabled

        fallback_enabled = self.fallback_enabled

        domain_scoped_enabled = self.domain_scoped_enabled

        http_enabled = self.http_enabled

        function_enabled = self.function_enabled


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "total": total,
            "enabled": enabled,
            "disabled": disabled,
            "fallback_enabled": fallback_enabled,
            "domain_scoped_enabled": domain_scoped_enabled,
            "http_enabled": http_enabled,
            "function_enabled": function_enabled,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        total = d.pop("total")

        enabled = d.pop("enabled")

        disabled = d.pop("disabled")

        fallback_enabled = d.pop("fallback_enabled")

        domain_scoped_enabled = d.pop("domain_scoped_enabled")

        http_enabled = d.pop("http_enabled")

        function_enabled = d.pop("function_enabled")

        inbox_status_endpoints = cls(
            total=total,
            enabled=enabled,
            disabled=disabled,
            fallback_enabled=fallback_enabled,
            domain_scoped_enabled=domain_scoped_enabled,
            http_enabled=http_enabled,
            function_enabled=function_enabled,
        )


        inbox_status_endpoints.additional_properties = d
        return inbox_status_endpoints

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
