from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_route_body_target_kind import FunctionRouteBodyTargetKind
from uuid import UUID






T = TypeVar("T", bound="FunctionRouteBodyTarget")



@_attrs_define
class FunctionRouteBodyTarget:
    """ 
        Attributes:
            kind (FunctionRouteBodyTargetKind):
            domain_id (UUID | Unset):
     """

    kind: FunctionRouteBodyTargetKind
    domain_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        domain_id: str | Unset = UNSET
        if not isinstance(self.domain_id, Unset):
            domain_id = str(self.domain_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
        })
        if domain_id is not UNSET:
            field_dict["domainId"] = domain_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = FunctionRouteBodyTargetKind(d.pop("kind"))




        _domain_id = d.pop("domainId", UNSET)
        domain_id: UUID | Unset
        if isinstance(_domain_id,  Unset):
            domain_id = UNSET
        else:
            domain_id = UUID(_domain_id)




        function_route_body_target = cls(
            kind=kind,
            domain_id=domain_id,
        )


        function_route_body_target.additional_properties = d
        return function_route_body_target

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
