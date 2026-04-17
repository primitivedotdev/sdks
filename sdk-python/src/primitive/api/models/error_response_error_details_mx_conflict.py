from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ErrorResponseErrorDetailsMxConflict")



@_attrs_define
class ErrorResponseErrorDetailsMxConflict:
    """ Present when `code == mx_conflict`.

        Attributes:
            provider_name (str): Human-readable name of the detected mailbox provider (e.g. "Google Workspace").
            suggested_subdomain (str): Subdomain to try instead (e.g. "mail" for `mail.example.com`).
     """

    provider_name: str
    suggested_subdomain: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        provider_name = self.provider_name

        suggested_subdomain = self.suggested_subdomain


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "provider_name": provider_name,
            "suggested_subdomain": suggested_subdomain,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        provider_name = d.pop("provider_name")

        suggested_subdomain = d.pop("suggested_subdomain")

        error_response_error_details_mx_conflict = cls(
            provider_name=provider_name,
            suggested_subdomain=suggested_subdomain,
        )


        error_response_error_details_mx_conflict.additional_properties = d
        return error_response_error_details_mx_conflict

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
