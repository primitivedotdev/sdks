from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="EmailRuleBreadth")



@_attrs_define
class EmailRuleBreadth:
    """ 
        Attributes:
            checked (int): Classified emails the conditions were decided for: of the newest 200 from the last 30 days in the
                scope counted (evaluation_scope as sent; by default your own mailboxes, for a grant rule those you may share),
                the ones you can still read.
            matched (int): Of those, how many they hold for (for a do-not-share rule, one they cannot decide counts).
     """

    checked: int
    matched: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        checked = self.checked

        matched = self.matched


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "checked": checked,
            "matched": matched,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        checked = d.pop("checked")

        matched = d.pop("matched")

        email_rule_breadth = cls(
            checked=checked,
            matched=matched,
        )


        email_rule_breadth.additional_properties = d
        return email_rule_breadth

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
