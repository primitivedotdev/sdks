from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_route_body_target_type_0_kind import FunctionRouteBodyTargetType0Kind
from uuid import UUID






T = TypeVar("T", bound="FunctionRouteBodyTargetType0")



@_attrs_define
class FunctionRouteBodyTargetType0:
    """ 
        Attributes:
            kind (FunctionRouteBodyTargetType0Kind):
            domain_id (UUID):
     """

    kind: FunctionRouteBodyTargetType0Kind
    domain_id: UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        domain_id = str(self.domain_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "domainId": domain_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = FunctionRouteBodyTargetType0Kind(d.pop("kind"))




        domain_id = UUID(d.pop("domainId"))




        function_route_body_target_type_0 = cls(
            kind=kind,
            domain_id=domain_id,
        )


        function_route_body_target_type_0.additional_properties = d
        return function_route_body_target_type_0

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
