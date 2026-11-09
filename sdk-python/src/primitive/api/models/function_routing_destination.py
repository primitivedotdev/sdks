from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_routing_destination_kind import FunctionRoutingDestinationKind
from ..models.function_routing_destination_scope import FunctionRoutingDestinationScope
from typing import cast

if TYPE_CHECKING:
  from ..models.function_routing_destination_function import FunctionRoutingDestinationFunction





T = TypeVar("T", bound="FunctionRoutingDestination")



@_attrs_define
class FunctionRoutingDestination:
    """ Where inbound mail that no recipient route matches is delivered: a function or a webhook, from the domain's own
    default (scope domain) or the organization's (scope org). Null when there is none. host is shown only to a caller
    that may read webhooks. owner_scoped is true when the organization does not own the destination, so it receives only
    the mail its owner can read.

        Attributes:
            kind (FunctionRoutingDestinationKind):
            scope (FunctionRoutingDestinationScope):
            function (FunctionRoutingDestinationFunction | Unset):
            host (str | Unset):
            owner_scoped (bool | Unset):
     """

    kind: FunctionRoutingDestinationKind
    scope: FunctionRoutingDestinationScope
    function: FunctionRoutingDestinationFunction | Unset = UNSET
    host: str | Unset = UNSET
    owner_scoped: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_routing_destination_function import FunctionRoutingDestinationFunction # noqa: PLC0415
        kind = self.kind.value

        scope = self.scope.value

        function: dict[str, Any] | Unset = UNSET
        if not isinstance(self.function, Unset):
            function = self.function.to_dict()

        host = self.host

        owner_scoped = self.owner_scoped


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "scope": scope,
        })
        if function is not UNSET:
            field_dict["function"] = function
        if host is not UNSET:
            field_dict["host"] = host
        if owner_scoped is not UNSET:
            field_dict["owner_scoped"] = owner_scoped

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_routing_destination_function import FunctionRoutingDestinationFunction # noqa: PLC0415
        d = dict(src_dict)
        kind = FunctionRoutingDestinationKind(d.pop("kind"))




        scope = FunctionRoutingDestinationScope(d.pop("scope"))




        _function = d.pop("function", UNSET)
        function: FunctionRoutingDestinationFunction | Unset
        if isinstance(_function,  Unset):
            function = UNSET
        else:
            function = FunctionRoutingDestinationFunction.from_dict(_function)




        host = d.pop("host", UNSET)

        owner_scoped = d.pop("owner_scoped", UNSET)

        function_routing_destination = cls(
            kind=kind,
            scope=scope,
            function=function,
            host=host,
            owner_scoped=owner_scoped,
        )


        function_routing_destination.additional_properties = d
        return function_routing_destination

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
