from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_detail_test_readiness_reason import FunctionDetailTestReadinessReason
from typing import cast

if TYPE_CHECKING:
  from ..models.function_detail_test_readiness_domain import FunctionDetailTestReadinessDomain
  from ..models.function_detail_test_readiness_endpoint import FunctionDetailTestReadinessEndpoint





T = TypeVar("T", bound="FunctionDetailTestReadiness")



@_attrs_define
class FunctionDetailTestReadiness:
    """ Whether a test run (testFunction) can be sent now. When ready is false, reason says why: no_endpoint (the function
    is not routed), no_inbound_domain (no domain can receive the test) or not_permitted (the caller may not run it).
    When ready is true, endpoint and domain name where the test lands, unless that domain is outside the caller's scope.

        Attributes:
            ready (bool):
            reason (FunctionDetailTestReadinessReason | Unset):
            endpoint (FunctionDetailTestReadinessEndpoint | Unset):
            domain (FunctionDetailTestReadinessDomain | Unset):
     """

    ready: bool
    reason: FunctionDetailTestReadinessReason | Unset = UNSET
    endpoint: FunctionDetailTestReadinessEndpoint | Unset = UNSET
    domain: FunctionDetailTestReadinessDomain | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_detail_test_readiness_domain import FunctionDetailTestReadinessDomain # noqa: PLC0415
        from ..models.function_detail_test_readiness_endpoint import FunctionDetailTestReadinessEndpoint # noqa: PLC0415
        ready = self.ready

        reason: str | Unset = UNSET
        if not isinstance(self.reason, Unset):
            reason = self.reason.value


        endpoint: dict[str, Any] | Unset = UNSET
        if not isinstance(self.endpoint, Unset):
            endpoint = self.endpoint.to_dict()

        domain: dict[str, Any] | Unset = UNSET
        if not isinstance(self.domain, Unset):
            domain = self.domain.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "ready": ready,
        })
        if reason is not UNSET:
            field_dict["reason"] = reason
        if endpoint is not UNSET:
            field_dict["endpoint"] = endpoint
        if domain is not UNSET:
            field_dict["domain"] = domain

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_detail_test_readiness_domain import FunctionDetailTestReadinessDomain # noqa: PLC0415
        from ..models.function_detail_test_readiness_endpoint import FunctionDetailTestReadinessEndpoint # noqa: PLC0415
        d = dict(src_dict)
        ready = d.pop("ready")

        _reason = d.pop("reason", UNSET)
        reason: FunctionDetailTestReadinessReason | Unset
        if isinstance(_reason,  Unset):
            reason = UNSET
        else:
            reason = FunctionDetailTestReadinessReason(_reason)




        _endpoint = d.pop("endpoint", UNSET)
        endpoint: FunctionDetailTestReadinessEndpoint | Unset
        if isinstance(_endpoint,  Unset):
            endpoint = UNSET
        else:
            endpoint = FunctionDetailTestReadinessEndpoint.from_dict(_endpoint)




        _domain = d.pop("domain", UNSET)
        domain: FunctionDetailTestReadinessDomain | Unset
        if isinstance(_domain,  Unset):
            domain = UNSET
        else:
            domain = FunctionDetailTestReadinessDomain.from_dict(_domain)




        function_detail_test_readiness = cls(
            ready=ready,
            reason=reason,
            endpoint=endpoint,
            domain=domain,
        )


        function_detail_test_readiness.additional_properties = d
        return function_detail_test_readiness

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
