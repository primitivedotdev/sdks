from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_look_alike import EmailRuleLookAlike
  from ..models.generate_look_alikes_result_counts import GenerateLookAlikesResultCounts
  from ..models.generate_look_alikes_result_rule import GenerateLookAlikesResultRule





T = TypeVar("T", bound="GenerateLookAlikesResult")



@_attrs_define
class GenerateLookAlikesResult:
    """ 
        Attributes:
            rule (GenerateLookAlikesResultRule):
            look_alikes (list[EmailRuleLookAlike]):
            counts (GenerateLookAlikesResultCounts):
            note (str): That the emails are made up and were never sent or stored.
     """

    rule: GenerateLookAlikesResultRule
    look_alikes: list[EmailRuleLookAlike]
    counts: GenerateLookAlikesResultCounts
    note: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_look_alike import EmailRuleLookAlike # noqa: PLC0415
        from ..models.generate_look_alikes_result_counts import GenerateLookAlikesResultCounts # noqa: PLC0415
        from ..models.generate_look_alikes_result_rule import GenerateLookAlikesResultRule # noqa: PLC0415
        rule = self.rule.to_dict()

        look_alikes = []
        for look_alikes_item_data in self.look_alikes:
            look_alikes_item = look_alikes_item_data.to_dict()
            look_alikes.append(look_alikes_item)



        counts = self.counts.to_dict()

        note = self.note


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rule": rule,
            "look_alikes": look_alikes,
            "counts": counts,
            "note": note,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_look_alike import EmailRuleLookAlike # noqa: PLC0415
        from ..models.generate_look_alikes_result_counts import GenerateLookAlikesResultCounts # noqa: PLC0415
        from ..models.generate_look_alikes_result_rule import GenerateLookAlikesResultRule # noqa: PLC0415
        d = dict(src_dict)
        rule = GenerateLookAlikesResultRule.from_dict(d.pop("rule"))




        look_alikes = []
        _look_alikes = d.pop("look_alikes")
        for look_alikes_item_data in (_look_alikes):
            look_alikes_item = EmailRuleLookAlike.from_dict(look_alikes_item_data)



            look_alikes.append(look_alikes_item)


        counts = GenerateLookAlikesResultCounts.from_dict(d.pop("counts"))




        note = d.pop("note")

        generate_look_alikes_result = cls(
            rule=rule,
            look_alikes=look_alikes,
            counts=counts,
            note=note,
        )


        generate_look_alikes_result.additional_properties = d
        return generate_look_alikes_result

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
