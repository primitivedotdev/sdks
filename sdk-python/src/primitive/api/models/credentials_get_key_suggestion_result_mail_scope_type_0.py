from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_get_key_suggestion_result_mail_scope_type_0_depth import CredentialsGetKeySuggestionResultMailScopeType0Depth
from typing import cast






T = TypeVar("T", bound="CredentialsGetKeySuggestionResultMailScopeType0")



@_attrs_define
class CredentialsGetKeySuggestionResultMailScopeType0:
    """ 
        Attributes:
            available (bool):
            unavailable_message (None | str):
            addresses (list[str]):
            domains (list[str]):
            depth (CredentialsGetKeySuggestionResultMailScopeType0Depth): Deprecated: raw when the key downloaded raw MIME,
                otherwise content.
            depth_reason (str):
            complete (bool):
            blocked_by (list[str]):
            notes (list[str]):
     """

    available: bool
    unavailable_message: None | str
    addresses: list[str]
    domains: list[str]
    depth: CredentialsGetKeySuggestionResultMailScopeType0Depth
    depth_reason: str
    complete: bool
    blocked_by: list[str]
    notes: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        available = self.available

        unavailable_message: None | str
        unavailable_message = self.unavailable_message

        addresses = self.addresses



        domains = self.domains



        depth = self.depth.value

        depth_reason = self.depth_reason

        complete = self.complete

        blocked_by = self.blocked_by



        notes = self.notes




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "available": available,
            "unavailable_message": unavailable_message,
            "addresses": addresses,
            "domains": domains,
            "depth": depth,
            "depth_reason": depth_reason,
            "complete": complete,
            "blocked_by": blocked_by,
            "notes": notes,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        available = d.pop("available")

        def _parse_unavailable_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        unavailable_message = _parse_unavailable_message(d.pop("unavailable_message"))


        addresses = cast(list[str], d.pop("addresses"))


        domains = cast(list[str], d.pop("domains"))


        depth = CredentialsGetKeySuggestionResultMailScopeType0Depth(d.pop("depth"))




        depth_reason = d.pop("depth_reason")

        complete = d.pop("complete")

        blocked_by = cast(list[str], d.pop("blocked_by"))


        notes = cast(list[str], d.pop("notes"))


        credentials_get_key_suggestion_result_mail_scope_type_0 = cls(
            available=available,
            unavailable_message=unavailable_message,
            addresses=addresses,
            domains=domains,
            depth=depth,
            depth_reason=depth_reason,
            complete=complete,
            blocked_by=blocked_by,
            notes=notes,
        )


        credentials_get_key_suggestion_result_mail_scope_type_0.additional_properties = d
        return credentials_get_key_suggestion_result_mail_scope_type_0

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
