from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.contact_policy_rule_input_effect import ContactPolicyRuleInputEffect






T = TypeVar("T", bound="ContactPolicyRuleInput")



@_attrs_define
class ContactPolicyRuleInput:
    """ 
        Attributes:
            pattern (str): Exact mailbox or restricted mailbox glob. See operation description.
            effect (ContactPolicyRuleInputEffect):
     """

    pattern: str
    effect: ContactPolicyRuleInputEffect





    def to_dict(self) -> dict[str, Any]:
        pattern = self.pattern

        effect = self.effect.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "pattern": pattern,
            "effect": effect,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        pattern = d.pop("pattern")

        effect = ContactPolicyRuleInputEffect(d.pop("effect"))




        contact_policy_rule_input = cls(
            pattern=pattern,
            effect=effect,
        )

        return contact_policy_rule_input

