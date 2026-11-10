from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="UpdateEmailRuleRequestScopeSelection")



@_attrs_define
class UpdateEmailRuleRequestScopeSelection:
    """ Inboxes, and domains (every address at them the author can read), for a selected rule; each one you can read.

        Attributes:
            addresses (list[str] | Unset):
            domains (list[str] | Unset):
     """

    addresses: list[str] | Unset = UNSET
    domains: list[str] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        addresses: list[str] | Unset = UNSET
        if not isinstance(self.addresses, Unset):
            addresses = self.addresses



        domains: list[str] | Unset = UNSET
        if not isinstance(self.domains, Unset):
            domains = self.domains




        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if addresses is not UNSET:
            field_dict["addresses"] = addresses
        if domains is not UNSET:
            field_dict["domains"] = domains

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        addresses = cast(list[str], d.pop("addresses", UNSET))


        domains = cast(list[str], d.pop("domains", UNSET))


        update_email_rule_request_scope_selection = cls(
            addresses=addresses,
            domains=domains,
        )

        return update_email_rule_request_scope_selection

