from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.get_org_function_usage_result_lifetime import GetOrgFunctionUsageResultLifetime
  from ..models.get_org_function_usage_result_monthly import GetOrgFunctionUsageResultMonthly





T = TypeVar("T", bound="GetOrgFunctionUsageResult")



@_attrs_define
class GetOrgFunctionUsageResult:
    """ 
        Attributes:
            monthly (GetOrgFunctionUsageResultMonthly):
            lifetime (GetOrgFunctionUsageResultLifetime):
            active_functions (float):
     """

    monthly: GetOrgFunctionUsageResultMonthly
    lifetime: GetOrgFunctionUsageResultLifetime
    active_functions: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_org_function_usage_result_lifetime import GetOrgFunctionUsageResultLifetime # noqa: PLC0415
        from ..models.get_org_function_usage_result_monthly import GetOrgFunctionUsageResultMonthly # noqa: PLC0415
        monthly = self.monthly.to_dict()

        lifetime = self.lifetime.to_dict()

        active_functions = self.active_functions


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "monthly": monthly,
            "lifetime": lifetime,
            "active_functions": active_functions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_org_function_usage_result_lifetime import GetOrgFunctionUsageResultLifetime # noqa: PLC0415
        from ..models.get_org_function_usage_result_monthly import GetOrgFunctionUsageResultMonthly # noqa: PLC0415
        d = dict(src_dict)
        monthly = GetOrgFunctionUsageResultMonthly.from_dict(d.pop("monthly"))




        lifetime = GetOrgFunctionUsageResultLifetime.from_dict(d.pop("lifetime"))




        active_functions = d.pop("active_functions")

        get_org_function_usage_result = cls(
            monthly=monthly,
            lifetime=lifetime,
            active_functions=active_functions,
        )


        get_org_function_usage_result.additional_properties = d
        return get_org_function_usage_result

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
