from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.function_route_body_target_type_0 import FunctionRouteBodyTargetType0
  from ..models.function_route_body_target_type_1 import FunctionRouteBodyTargetType1





T = TypeVar("T", bound="FunctionRouteBody")



@_attrs_define
class FunctionRouteBody:
    """ Target for a route binding. Either a specific verified domain
    (scoped) or the org-wide fallback. Pass `takeover: true` to
    deactivate any conflicting binding before installing this one.

        Attributes:
            target (FunctionRouteBodyTargetType0 | FunctionRouteBodyTargetType1):
            takeover (bool | Unset): When true, deactivate any conflicting binding before installing this one.
     """

    target: FunctionRouteBodyTargetType0 | FunctionRouteBodyTargetType1
    takeover: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_route_body_target_type_0 import FunctionRouteBodyTargetType0
        from ..models.function_route_body_target_type_1 import FunctionRouteBodyTargetType1
        target: dict[str, Any]
        if isinstance(self.target, FunctionRouteBodyTargetType0):
            target = self.target.to_dict()
        else:
            target = self.target.to_dict()


        takeover = self.takeover


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "target": target,
        })
        if takeover is not UNSET:
            field_dict["takeover"] = takeover

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_route_body_target_type_0 import FunctionRouteBodyTargetType0
        from ..models.function_route_body_target_type_1 import FunctionRouteBodyTargetType1
        d = dict(src_dict)
        def _parse_target(data: object) -> FunctionRouteBodyTargetType0 | FunctionRouteBodyTargetType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                target_type_0 = FunctionRouteBodyTargetType0.from_dict(data)



                return target_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            target_type_1 = FunctionRouteBodyTargetType1.from_dict(data)



            return target_type_1

        target = _parse_target(d.pop("target"))


        takeover = d.pop("takeover", UNSET)

        function_route_body = cls(
            target=target,
            takeover=takeover,
        )


        function_route_body.additional_properties = d
        return function_route_body

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
