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
            note (str):
            rule_id (str | Unset):
     """

    ended: bool
    note: str
    rule_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        ended = self.ended

        note = self.note

        rule_id = self.rule_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "ended": ended,
            "note": note,
        })
        if rule_id is not UNSET:
            field_dict["rule_id"] = rule_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ended = d.pop("ended")

        note = d.pop("note")

        rule_id = d.pop("rule_id", UNSET)

        end_email_rule_share_result = cls(
            ended=ended,
            note=note,
            rule_id=rule_id,
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
