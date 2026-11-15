from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="CreateEmailRuleResultAffects")



@_attrs_define
class CreateEmailRuleResultAffects:
    """ After an update that saved a version, or turned a grant rule active: your own keys and webhooks that receive what it
    grants from now on, counted as receivers counts them, and how many live shares it has. Nothing about a colleague it
    is shared with is counted. All zero for a rule that is not an active grant rule. Absent after any other write, and
    if not read.

        Attributes:
            keys (int):
            webhooks (int):
            shares (int):
     """

    keys: int
    webhooks: int
    shares: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        keys = self.keys

        webhooks = self.webhooks

        shares = self.shares


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "keys": keys,
            "webhooks": webhooks,
            "shares": shares,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        keys = d.pop("keys")

        webhooks = d.pop("webhooks")

        shares = d.pop("shares")

        create_email_rule_result_affects = cls(
            keys=keys,
            webhooks=webhooks,
            shares=shares,
        )


        create_email_rule_result_affects.additional_properties = d
        return create_email_rule_result_affects

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
