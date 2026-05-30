from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.function_routing_domain_type_0 import FunctionRoutingDomainType0
  from ..models.function_routing_rules import FunctionRoutingRules





T = TypeVar("T", bound="FunctionRouting")



@_attrs_define
class FunctionRouting:
    """ A single route binding for a function. `domain` is null when the
    binding is the org's fallback (any active domain without a scoped
    binding); otherwise it carries the scoped domain. `rules` is
    reserved for future routing predicates.

        Attributes:
            endpoint_id (UUID):
            enabled (bool):
            domain (FunctionRoutingDomainType0 | None):
            rules (FunctionRoutingRules): Future routing predicates. Currently empty.
            delivery_count (int | Unset):
            success_count (int | Unset):
            failure_count (int | Unset):
            consecutive_fails (int | Unset):
            last_delivery_at (datetime.datetime | None | Unset):
            last_success_at (datetime.datetime | None | Unset):
            last_failure_at (datetime.datetime | None | Unset):
     """

    endpoint_id: UUID
    enabled: bool
    domain: FunctionRoutingDomainType0 | None
    rules: FunctionRoutingRules
    delivery_count: int | Unset = UNSET
    success_count: int | Unset = UNSET
    failure_count: int | Unset = UNSET
    consecutive_fails: int | Unset = UNSET
    last_delivery_at: datetime.datetime | None | Unset = UNSET
    last_success_at: datetime.datetime | None | Unset = UNSET
    last_failure_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_routing_domain_type_0 import FunctionRoutingDomainType0
        from ..models.function_routing_rules import FunctionRoutingRules
        endpoint_id = str(self.endpoint_id)

        enabled = self.enabled

        domain: dict[str, Any] | None
        if isinstance(self.domain, FunctionRoutingDomainType0):
            domain = self.domain.to_dict()
        else:
            domain = self.domain

        rules = self.rules.to_dict()

        delivery_count = self.delivery_count

        success_count = self.success_count

        failure_count = self.failure_count

        consecutive_fails = self.consecutive_fails

        last_delivery_at: None | str | Unset
        if isinstance(self.last_delivery_at, Unset):
            last_delivery_at = UNSET
        elif isinstance(self.last_delivery_at, datetime.datetime):
            last_delivery_at = self.last_delivery_at.isoformat()
        else:
            last_delivery_at = self.last_delivery_at

        last_success_at: None | str | Unset
        if isinstance(self.last_success_at, Unset):
            last_success_at = UNSET
        elif isinstance(self.last_success_at, datetime.datetime):
            last_success_at = self.last_success_at.isoformat()
        else:
            last_success_at = self.last_success_at

        last_failure_at: None | str | Unset
        if isinstance(self.last_failure_at, Unset):
            last_failure_at = UNSET
        elif isinstance(self.last_failure_at, datetime.datetime):
            last_failure_at = self.last_failure_at.isoformat()
        else:
            last_failure_at = self.last_failure_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "endpoint_id": endpoint_id,
            "enabled": enabled,
            "domain": domain,
            "rules": rules,
        })
        if delivery_count is not UNSET:
            field_dict["delivery_count"] = delivery_count
        if success_count is not UNSET:
            field_dict["success_count"] = success_count
        if failure_count is not UNSET:
            field_dict["failure_count"] = failure_count
        if consecutive_fails is not UNSET:
            field_dict["consecutive_fails"] = consecutive_fails
        if last_delivery_at is not UNSET:
            field_dict["last_delivery_at"] = last_delivery_at
        if last_success_at is not UNSET:
            field_dict["last_success_at"] = last_success_at
        if last_failure_at is not UNSET:
            field_dict["last_failure_at"] = last_failure_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_routing_domain_type_0 import FunctionRoutingDomainType0
        from ..models.function_routing_rules import FunctionRoutingRules
        d = dict(src_dict)
        endpoint_id = UUID(d.pop("endpoint_id"))




        enabled = d.pop("enabled")

        def _parse_domain(data: object) -> FunctionRoutingDomainType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                domain_type_0 = FunctionRoutingDomainType0.from_dict(data)



                return domain_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FunctionRoutingDomainType0 | None, data)

        domain = _parse_domain(d.pop("domain"))


        rules = FunctionRoutingRules.from_dict(d.pop("rules"))




        delivery_count = d.pop("delivery_count", UNSET)

        success_count = d.pop("success_count", UNSET)

        failure_count = d.pop("failure_count", UNSET)

        consecutive_fails = d.pop("consecutive_fails", UNSET)

        def _parse_last_delivery_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_delivery_at_type_0 = isoparse(data)



                return last_delivery_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_delivery_at = _parse_last_delivery_at(d.pop("last_delivery_at", UNSET))


        def _parse_last_success_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_success_at_type_0 = isoparse(data)



                return last_success_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_success_at = _parse_last_success_at(d.pop("last_success_at", UNSET))


        def _parse_last_failure_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_failure_at_type_0 = isoparse(data)



                return last_failure_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_failure_at = _parse_last_failure_at(d.pop("last_failure_at", UNSET))


        function_routing = cls(
            endpoint_id=endpoint_id,
            enabled=enabled,
            domain=domain,
            rules=rules,
            delivery_count=delivery_count,
            success_count=success_count,
            failure_count=failure_count,
            consecutive_fails=consecutive_fails,
            last_delivery_at=last_delivery_at,
            last_success_at=last_success_at,
            last_failure_at=last_failure_at,
        )


        function_routing.additional_properties = d
        return function_routing

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
