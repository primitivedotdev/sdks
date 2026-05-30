from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_route_body_target_type_1_kind import FunctionRouteBodyTargetType1Kind






T = TypeVar("T", bound="FunctionRouteBodyTargetType1")



@_attrs_define
class FunctionRouteBodyTargetType1:
    """ 
        Attributes:
            kind (FunctionRouteBodyTargetType1Kind):
     """

    kind: FunctionRouteBodyTargetType1Kind
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = FunctionRouteBodyTargetType1Kind(d.pop("kind"))




        function_route_body_target_type_1 = cls(
            kind=kind,
        )


        function_route_body_target_type_1.additional_properties = d
        return function_route_body_target_type_1

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
