from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.match_type import MatchType
from ..models.simulate_route_result_default_scope_type_1 import SimulateRouteResultDefaultScopeType1
from ..models.simulate_route_result_default_scope_type_2_type_1 import SimulateRouteResultDefaultScopeType2Type1
from ..models.simulate_route_result_default_scope_type_3_type_1 import SimulateRouteResultDefaultScopeType3Type1
from ..models.simulate_route_result_outcome import SimulateRouteResultOutcome
from typing import cast

if TYPE_CHECKING:
  from ..models.route_evaluation import RouteEvaluation





T = TypeVar("T", bound="SimulateRouteResult")



@_attrs_define
class SimulateRouteResult:
    """ 
        Attributes:
            outcome (SimulateRouteResultOutcome): matched: a route matched. defaulted: fell to the default destination.
                none: nowhere.
            recipient (str):
            endpoint_id (None | str): The endpoint mail would reach, or null when none.
            matched_route_id (None | str):
            matched_tier (MatchType | None):
            matched_pattern (None | str):
            default_scope (None | SimulateRouteResultDefaultScopeType1 | SimulateRouteResultDefaultScopeType2Type1 |
                SimulateRouteResultDefaultScopeType3Type1): Which default destination was used, when outcome is defaulted.
            evaluated (list[RouteEvaluation]):
            truncated (bool): True when the evaluation trace was capped.
     """

    outcome: SimulateRouteResultOutcome
    recipient: str
    endpoint_id: None | str
    matched_route_id: None | str
    matched_tier: MatchType | None
    matched_pattern: None | str
    default_scope: None | SimulateRouteResultDefaultScopeType1 | SimulateRouteResultDefaultScopeType2Type1 | SimulateRouteResultDefaultScopeType3Type1
    evaluated: list[RouteEvaluation]
    truncated: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.route_evaluation import RouteEvaluation
        outcome = self.outcome.value

        recipient = self.recipient

        endpoint_id: None | str
        endpoint_id = self.endpoint_id

        matched_route_id: None | str
        matched_route_id = self.matched_route_id

        matched_tier: None | str
        if isinstance(self.matched_tier, MatchType):
            matched_tier = self.matched_tier.value
        else:
            matched_tier = self.matched_tier

        matched_pattern: None | str
        matched_pattern = self.matched_pattern

        default_scope: None | str
        if isinstance(self.default_scope, SimulateRouteResultDefaultScopeType1):
            default_scope = self.default_scope.value
        elif isinstance(self.default_scope, SimulateRouteResultDefaultScopeType2Type1):
            default_scope = self.default_scope.value
        elif isinstance(self.default_scope, SimulateRouteResultDefaultScopeType3Type1):
            default_scope = self.default_scope.value
        else:
            default_scope = self.default_scope

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
        from ..models.route_evaluation import RouteEvaluation
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


        def _parse_matched_tier(data: object) -> MatchType | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                matched_tier_type_0 = MatchType(data)



                return matched_tier_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(MatchType | None, data)

        matched_tier = _parse_matched_tier(d.pop("matched_tier"))


        def _parse_matched_pattern(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        matched_pattern = _parse_matched_pattern(d.pop("matched_pattern"))


        def _parse_default_scope(data: object) -> None | SimulateRouteResultDefaultScopeType1 | SimulateRouteResultDefaultScopeType2Type1 | SimulateRouteResultDefaultScopeType3Type1:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                default_scope_type_1 = SimulateRouteResultDefaultScopeType1(data)



                return default_scope_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                default_scope_type_2_type_1 = SimulateRouteResultDefaultScopeType2Type1(data)



                return default_scope_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                default_scope_type_3_type_1 = SimulateRouteResultDefaultScopeType3Type1(data)



                return default_scope_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SimulateRouteResultDefaultScopeType1 | SimulateRouteResultDefaultScopeType2Type1 | SimulateRouteResultDefaultScopeType3Type1, data)

        default_scope = _parse_default_scope(d.pop("default_scope"))


        evaluated = []
        _evaluated = d.pop("evaluated")
        for evaluated_item_data in (_evaluated):
            evaluated_item = RouteEvaluation.from_dict(evaluated_item_data)



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
