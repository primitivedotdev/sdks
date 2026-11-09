from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CredentialsGetKeySuggestionResultUsageRoutesItem")



@_attrs_define
class CredentialsGetKeySuggestionResultUsageRoutesItem:
    """ 
        Attributes:
            method (str):
            route (None | str):
            requests (float):
            permissions (list[str]):
            super_admin_only (bool):
     """

    method: str
    route: None | str
    requests: float
    permissions: list[str]
    super_admin_only: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        method = self.method

        route: None | str
        route = self.route

        requests = self.requests

        permissions = self.permissions



        super_admin_only = self.super_admin_only


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "method": method,
            "route": route,
            "requests": requests,
            "permissions": permissions,
            "super_admin_only": super_admin_only,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        method = d.pop("method")

        def _parse_route(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        route = _parse_route(d.pop("route"))


        requests = d.pop("requests")

        permissions = cast(list[str], d.pop("permissions"))


        super_admin_only = d.pop("super_admin_only")

        credentials_get_key_suggestion_result_usage_routes_item = cls(
            method=method,
            route=route,
            requests=requests,
            permissions=permissions,
            super_admin_only=super_admin_only,
        )


        credentials_get_key_suggestion_result_usage_routes_item.additional_properties = d
        return credentials_get_key_suggestion_result_usage_routes_item

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
