from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="EndEmailRuleShareResult")



@_attrs_define
class EndEmailRuleShareResult:
    """ 
        Attributes:
            ended (bool):
            rule_id (str | Unset):
            note (str | Unset):
     """

    ended: bool
    rule_id: str | Unset = UNSET
    note: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        ended = self.ended

        rule_id = self.rule_id

        note = self.note


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "ended": ended,
        })
        if rule_id is not UNSET:
            field_dict["rule_id"] = rule_id
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ended = d.pop("ended")

        rule_id = d.pop("rule_id", UNSET)

        note = d.pop("note", UNSET)

        end_email_rule_share_result = cls(
            ended=ended,
            rule_id=rule_id,
            note=note,
        )


        end_email_rule_share_result.additional_properties = d
        return end_email_rule_share_result

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
