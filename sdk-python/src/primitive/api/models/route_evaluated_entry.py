from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.route_evaluated_entry_result import RouteEvaluatedEntryResult
from ..models.route_evaluated_entry_tier import RouteEvaluatedEntryTier






T = TypeVar("T", bound="RouteEvaluatedEntry")



@_attrs_define
class RouteEvaluatedEntry:
    """ 
        Attributes:
            route_id (str):
            tier (RouteEvaluatedEntryTier):
            pattern (str):
            result (RouteEvaluatedEntryResult):
            reason (str | Unset):
     """

    route_id: str
    tier: RouteEvaluatedEntryTier
    pattern: str
    result: RouteEvaluatedEntryResult
    reason: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        route_id = self.route_id

        tier = self.tier.value

        pattern = self.pattern

        result = self.result.value

        reason = self.reason


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "route_id": route_id,
            "tier": tier,
            "pattern": pattern,
            "result": result,
        })
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        route_id = d.pop("route_id")

        tier = RouteEvaluatedEntryTier(d.pop("tier"))




        pattern = d.pop("pattern")

        result = RouteEvaluatedEntryResult(d.pop("result"))




        reason = d.pop("reason", UNSET)

        route_evaluated_entry = cls(
            route_id=route_id,
            tier=tier,
            pattern=pattern,
            result=result,
            reason=reason,
        )


        route_evaluated_entry.additional_properties = d
        return route_evaluated_entry

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
