from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.simulate_route_result_default_scope import SimulateRouteResultDefaultScope
from ..models.simulate_route_result_matched_tier import SimulateRouteResultMatchedTier
from ..models.simulate_route_result_outcome import SimulateRouteResultOutcome
from typing import cast

if TYPE_CHECKING:
  from ..models.route_evaluated_entry import RouteEvaluatedEntry





T = TypeVar("T", bound="SimulateRouteResult")



@_attrs_define
class SimulateRouteResult:
    """ Where an inbound email to the recipient would be delivered, and why.

        Attributes:
            outcome (SimulateRouteResultOutcome):
            recipient (str):
            endpoint_id (None | str):
            matched_route_id (None | str):
            matched_tier (SimulateRouteResultMatchedTier):
            matched_pattern (None | str):
            default_scope (SimulateRouteResultDefaultScope):
            evaluated (list[RouteEvaluatedEntry]):
            truncated (bool):
     """

    outcome: SimulateRouteResultOutcome
    recipient: str
    endpoint_id: None | str
    matched_route_id: None | str
    matched_tier: SimulateRouteResultMatchedTier
    matched_pattern: None | str
    default_scope: SimulateRouteResultDefaultScope
    evaluated: list[RouteEvaluatedEntry]
    truncated: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.route_evaluated_entry import RouteEvaluatedEntry
        outcome = self.outcome.value

        recipient = self.recipient

        endpoint_id: None | str
        endpoint_id = self.endpoint_id

        matched_route_id: None | str
        matched_route_id = self.matched_route_id

        matched_tier = self.matched_tier.value

        matched_pattern: None | str
        matched_pattern = self.matched_pattern

        default_scope = self.default_scope.value

        evaluated = []
        for evaluated_item_data in self.evaluated:
            evaluated_item = evaluated_item_data.to_dict()
            evaluated.append(evaluated_item)



        truncated = self.truncated


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "outcome": outcome,
            "recipient": recipient,
            "endpoint_id": endpoint_id,
            "matched_route_id": matched_route_id,
            "matched_tier": matched_tier,
            "matched_pattern": matched_pattern,
            "default_scope": default_scope,
            "evaluated": evaluated,
            "truncated": truncated,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.route_evaluated_entry import RouteEvaluatedEntry
        d = dict(src_dict)
        outcome = SimulateRouteResultOutcome(d.pop("outcome"))




        recipient = d.pop("recipient")

        def _parse_endpoint_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        endpoint_id = _parse_endpoint_id(d.pop("endpoint_id"))


        def _parse_matched_route_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        matched_route_id = _parse_matched_route_id(d.pop("matched_route_id"))


        matched_tier = SimulateRouteResultMatchedTier(d.pop("matched_tier"))




        def _parse_matched_pattern(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        matched_pattern = _parse_matched_pattern(d.pop("matched_pattern"))


        default_scope = SimulateRouteResultDefaultScope(d.pop("default_scope"))




        evaluated = []
        _evaluated = d.pop("evaluated")
        for evaluated_item_data in (_evaluated):
            evaluated_item = RouteEvaluatedEntry.from_dict(evaluated_item_data)



            evaluated.append(evaluated_item)


        truncated = d.pop("truncated")

        simulate_route_result = cls(
            outcome=outcome,
            recipient=recipient,
            endpoint_id=endpoint_id,
            matched_route_id=matched_route_id,
            matched_tier=matched_tier,
            matched_pattern=matched_pattern,
            default_scope=default_scope,
            evaluated=evaluated,
            truncated=truncated,
        )


        simulate_route_result.additional_properties = d
        return simulate_route_result

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
