from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.routing_topology_domains_item_routed_function_type_0 import RoutingTopologyDomainsItemRoutedFunctionType0





T = TypeVar("T", bound="RoutingTopologyDomainsItem")



@_attrs_define
class RoutingTopologyDomainsItem:
    """ 
        Attributes:
            domain_id (UUID):
            domain (str):
            routed_function (None | RoutingTopologyDomainsItemRoutedFunctionType0):
            endpoint_enabled (bool | None):
     """

    domain_id: UUID
    domain: str
    routed_function: None | RoutingTopologyDomainsItemRoutedFunctionType0
    endpoint_enabled: bool | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.routing_topology_domains_item_routed_function_type_0 import RoutingTopologyDomainsItemRoutedFunctionType0
        domain_id = str(self.domain_id)

        domain = self.domain

        routed_function: dict[str, Any] | None
        if isinstance(self.routed_function, RoutingTopologyDomainsItemRoutedFunctionType0):
            routed_function = self.routed_function.to_dict()
        else:
            routed_function = self.routed_function

        endpoint_enabled: bool | None
        endpoint_enabled = self.endpoint_enabled


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "domain_id": domain_id,
            "domain": domain,
            "routed_function": routed_function,
            "endpoint_enabled": endpoint_enabled,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.routing_topology_domains_item_routed_function_type_0 import RoutingTopologyDomainsItemRoutedFunctionType0
        d = dict(src_dict)
        domain_id = UUID(d.pop("domain_id"))




        domain = d.pop("domain")

        def _parse_routed_function(data: object) -> None | RoutingTopologyDomainsItemRoutedFunctionType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                routed_function_type_0 = RoutingTopologyDomainsItemRoutedFunctionType0.from_dict(data)



                return routed_function_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | RoutingTopologyDomainsItemRoutedFunctionType0, data)

        routed_function = _parse_routed_function(d.pop("routed_function"))


        def _parse_endpoint_enabled(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        endpoint_enabled = _parse_endpoint_enabled(d.pop("endpoint_enabled"))


        routing_topology_domains_item = cls(
            domain_id=domain_id,
            domain=domain,
            routed_function=routed_function,
            endpoint_enabled=endpoint_enabled,
        )


        routing_topology_domains_item.additional_properties = d
        return routing_topology_domains_item

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
