from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="GetOrgFunctionUsageResultMonthly")



@_attrs_define
class GetOrgFunctionUsageResultMonthly:
    """ 
        Attributes:
            invocations (float):
            runtime_ms (float):
            delivered (float):
            failed (float):
     """

    invocations: float
    runtime_ms: float
    delivered: float
    failed: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        invocations = self.invocations

        runtime_ms = self.runtime_ms

        delivered = self.delivered

        failed = self.failed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "invocations": invocations,
            "runtime_ms": runtime_ms,
            "delivered": delivered,
            "failed": failed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        invocations = d.pop("invocations")

        runtime_ms = d.pop("runtime_ms")

        delivered = d.pop("delivered")

        failed = d.pop("failed")

        get_org_function_usage_result_monthly = cls(
            invocations=invocations,
            runtime_ms=runtime_ms,
            delivered=delivered,
            failed=failed,
        )


        get_org_function_usage_result_monthly.additional_properties = d
        return get_org_function_usage_result_monthly

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
