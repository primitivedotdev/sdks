from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.function_route_result_conflict import FunctionRouteResultConflict
  from ..models.function_routing import FunctionRouting





T = TypeVar("T", bound="FunctionRouteResult")



@_attrs_define
class FunctionRouteResult:
    """ On success, carries the new `routing`. On conflict, carries
    `conflict` describing the binding holder so the caller can
    re-issue with `takeover: true`.

        Attributes:
            routing (FunctionRouting | None | Unset):
            conflict (FunctionRouteResultConflict | Unset):
     """

    routing: FunctionRouting | None | Unset = UNSET
    conflict: FunctionRouteResultConflict | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_route_result_conflict import FunctionRouteResultConflict
        from ..models.function_routing import FunctionRouting
        routing: dict[str, Any] | None | Unset
        if isinstance(self.routing, Unset):
            routing = UNSET
        elif isinstance(self.routing, FunctionRouting):
            routing = self.routing.to_dict()
        else:
            routing = self.routing

        conflict: dict[str, Any] | Unset = UNSET
        if not isinstance(self.conflict, Unset):
            conflict = self.conflict.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if routing is not UNSET:
            field_dict["routing"] = routing
        if conflict is not UNSET:
            field_dict["conflict"] = conflict

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_route_result_conflict import FunctionRouteResultConflict
        from ..models.function_routing import FunctionRouting
        d = dict(src_dict)
        def _parse_routing(data: object) -> FunctionRouting | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                routing_type_0 = FunctionRouting.from_dict(data)



                return routing_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FunctionRouting | None | Unset, data)

        routing = _parse_routing(d.pop("routing", UNSET))


        _conflict = d.pop("conflict", UNSET)
        conflict: FunctionRouteResultConflict | Unset
        if isinstance(_conflict,  Unset):
            conflict = UNSET
        else:
            conflict = FunctionRouteResultConflict.from_dict(_conflict)




        function_route_result = cls(
            routing=routing,
            conflict=conflict,
        )


        function_route_result.additional_properties = d
        return function_route_result

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
