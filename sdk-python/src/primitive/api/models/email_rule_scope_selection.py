from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="EmailRuleScopeSelection")



@_attrs_define
class EmailRuleScopeSelection:
    """ For a selected rule: inboxes, and domains (each address at them the author reads); each one you can read.

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


        email_rule_scope_selection = cls(
            addresses=addresses,
            domains=domains,
        )

        return email_rule_scope_selection

