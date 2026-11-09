from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.function_routing_destination import FunctionRoutingDestination
  from ..models.routing_topology_domains_item import RoutingTopologyDomainsItem
  from ..models.routing_topology_fallback_function_type_0 import RoutingTopologyFallbackFunctionType0
  from ..models.routing_topology_unrouted_functions_item import RoutingTopologyUnroutedFunctionsItem





T = TypeVar("T", bound="RoutingTopology")



@_attrs_define
class RoutingTopology:
    """ Org-wide map of function routing: which domain points at which
    function, the org's fallback binding (if any), and every
    deployed function with no route currently bound.

        Attributes:
            domains (list[RoutingTopologyDomainsItem]):
            fallback_function (None | RoutingTopologyFallbackFunctionType0):
            fallback_enabled (bool | None):
            unrouted_functions (list[RoutingTopologyUnroutedFunctionsItem]):
            org_default_destination (FunctionRoutingDestination | None | Unset): Where mail on a verified domain with no
                route or default of its own goes, or null.
     """

    domains: list[RoutingTopologyDomainsItem]
    fallback_function: None | RoutingTopologyFallbackFunctionType0
    fallback_enabled: bool | None
    unrouted_functions: list[RoutingTopologyUnroutedFunctionsItem]
    org_default_destination: FunctionRoutingDestination | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_routing_destination import FunctionRoutingDestination # noqa: PLC0415
        from ..models.routing_topology_domains_item import RoutingTopologyDomainsItem # noqa: PLC0415
        from ..models.routing_topology_fallback_function_type_0 import RoutingTopologyFallbackFunctionType0 # noqa: PLC0415
        from ..models.routing_topology_unrouted_functions_item import RoutingTopologyUnroutedFunctionsItem # noqa: PLC0415
        domains = []
        for domains_item_data in self.domains:
            domains_item = domains_item_data.to_dict()
            domains.append(domains_item)



        fallback_function: dict[str, Any] | None
        if isinstance(self.fallback_function, RoutingTopologyFallbackFunctionType0):
            fallback_function = self.fallback_function.to_dict()
        else:
            fallback_function = self.fallback_function

        fallback_enabled: bool | None
        fallback_enabled = self.fallback_enabled

        unrouted_functions = []
        for unrouted_functions_item_data in self.unrouted_functions:
            unrouted_functions_item = unrouted_functions_item_data.to_dict()
            unrouted_functions.append(unrouted_functions_item)



        org_default_destination: dict[str, Any] | None | Unset
        if isinstance(self.org_default_destination, Unset):
            org_default_destination = UNSET
        elif isinstance(self.org_default_destination, FunctionRoutingDestination):
            org_default_destination = self.org_default_destination.to_dict()
        else:
            org_default_destination = self.org_default_destination


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "domains": domains,
            "fallback_function": fallback_function,
            "fallback_enabled": fallback_enabled,
            "unrouted_functions": unrouted_functions,
        })
        if org_default_destination is not UNSET:
            field_dict["org_default_destination"] = org_default_destination

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_routing_destination import FunctionRoutingDestination # noqa: PLC0415
        from ..models.routing_topology_domains_item import RoutingTopologyDomainsItem # noqa: PLC0415
        from ..models.routing_topology_fallback_function_type_0 import RoutingTopologyFallbackFunctionType0 # noqa: PLC0415
        from ..models.routing_topology_unrouted_functions_item import RoutingTopologyUnroutedFunctionsItem # noqa: PLC0415
        d = dict(src_dict)
        domains = []
        _domains = d.pop("domains")
        for domains_item_data in (_domains):
            domains_item = RoutingTopologyDomainsItem.from_dict(domains_item_data)



            domains.append(domains_item)


        def _parse_fallback_function(data: object) -> None | RoutingTopologyFallbackFunctionType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                fallback_function_type_0 = RoutingTopologyFallbackFunctionType0.from_dict(data)



                return fallback_function_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | RoutingTopologyFallbackFunctionType0, data)

        fallback_function = _parse_fallback_function(d.pop("fallback_function"))


        def _parse_fallback_enabled(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        fallback_enabled = _parse_fallback_enabled(d.pop("fallback_enabled"))


        unrouted_functions = []
        _unrouted_functions = d.pop("unrouted_functions")
        for unrouted_functions_item_data in (_unrouted_functions):
            unrouted_functions_item = RoutingTopologyUnroutedFunctionsItem.from_dict(unrouted_functions_item_data)



            unrouted_functions.append(unrouted_functions_item)


        def _parse_org_default_destination(data: object) -> FunctionRoutingDestination | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                org_default_destination_type_1 = FunctionRoutingDestination.from_dict(data)



                return org_default_destination_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FunctionRoutingDestination | None | Unset, data)

        org_default_destination = _parse_org_default_destination(d.pop("org_default_destination", UNSET))


        routing_topology = cls(
            domains=domains,
            fallback_function=fallback_function,
            fallback_enabled=fallback_enabled,
            unrouted_functions=unrouted_functions,
            org_default_destination=org_default_destination,
        )


        routing_topology.additional_properties = d
        return routing_topology

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
