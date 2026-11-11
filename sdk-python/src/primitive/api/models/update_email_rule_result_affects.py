from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="UpdateEmailRuleResultAffects")



@_attrs_define
class UpdateEmailRuleResultAffects:
    """ After an update that saved a version: API keys listing the rule, the webhooks they own, and shares this write ended.
    The rule keeps its state. Absent if not read.

        Attributes:
            keys (int):
            endpoints (int):
            shares_ended (int):
     """

    keys: int
    endpoints: int
    shares_ended: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        keys = self.keys

        endpoints = self.endpoints

        shares_ended = self.shares_ended


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "keys": keys,
            "endpoints": endpoints,
            "shares_ended": shares_ended,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        keys = d.pop("keys")

        endpoints = d.pop("endpoints")

        shares_ended = d.pop("shares_ended")

        update_email_rule_result_affects = cls(
            keys=keys,
            endpoints=endpoints,
            shares_ended=shares_ended,
        )


        update_email_rule_result_affects.additional_properties = d
        return update_email_rule_result_affects

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
