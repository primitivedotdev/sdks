from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.get_org_function_invocation_series_result_buckets_item import GetOrgFunctionInvocationSeriesResultBucketsItem
  from ..models.get_org_function_invocation_series_result_functions_item import GetOrgFunctionInvocationSeriesResultFunctionsItem
  from ..models.get_org_function_invocation_series_result_points_item import GetOrgFunctionInvocationSeriesResultPointsItem





T = TypeVar("T", bound="GetOrgFunctionInvocationSeriesResult")



@_attrs_define
class GetOrgFunctionInvocationSeriesResult:
    """ 
        Attributes:
            days (int):
            buckets (list[GetOrgFunctionInvocationSeriesResultBucketsItem]):
            functions (list[GetOrgFunctionInvocationSeriesResultFunctionsItem]):
            points (list[GetOrgFunctionInvocationSeriesResultPointsItem]):
     """

    days: int
    buckets: list[GetOrgFunctionInvocationSeriesResultBucketsItem]
    functions: list[GetOrgFunctionInvocationSeriesResultFunctionsItem]
    points: list[GetOrgFunctionInvocationSeriesResultPointsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_org_function_invocation_series_result_buckets_item import GetOrgFunctionInvocationSeriesResultBucketsItem # noqa: PLC0415
        from ..models.get_org_function_invocation_series_result_functions_item import GetOrgFunctionInvocationSeriesResultFunctionsItem # noqa: PLC0415
        from ..models.get_org_function_invocation_series_result_points_item import GetOrgFunctionInvocationSeriesResultPointsItem # noqa: PLC0415
        days = self.days

        buckets = []
        for buckets_item_data in self.buckets:
            buckets_item = buckets_item_data.to_dict()
            buckets.append(buckets_item)



        functions = []
        for functions_item_data in self.functions:
            functions_item = functions_item_data.to_dict()
            functions.append(functions_item)



        points = []
        for points_item_data in self.points:
            points_item = points_item_data.to_dict()
            points.append(points_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "days": days,
            "buckets": buckets,
            "functions": functions,
            "points": points,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_org_function_invocation_series_result_buckets_item import GetOrgFunctionInvocationSeriesResultBucketsItem # noqa: PLC0415
        from ..models.get_org_function_invocation_series_result_functions_item import GetOrgFunctionInvocationSeriesResultFunctionsItem # noqa: PLC0415
        from ..models.get_org_function_invocation_series_result_points_item import GetOrgFunctionInvocationSeriesResultPointsItem # noqa: PLC0415
        d = dict(src_dict)
        days = d.pop("days")

        buckets = []
        _buckets = d.pop("buckets")
        for buckets_item_data in (_buckets):
            buckets_item = GetOrgFunctionInvocationSeriesResultBucketsItem.from_dict(buckets_item_data)



            buckets.append(buckets_item)


        functions = []
        _functions = d.pop("functions")
        for functions_item_data in (_functions):
            functions_item = GetOrgFunctionInvocationSeriesResultFunctionsItem.from_dict(functions_item_data)



            functions.append(functions_item)


        points = []
        _points = d.pop("points")
        for points_item_data in (_points):
            points_item = GetOrgFunctionInvocationSeriesResultPointsItem.from_dict(points_item_data)



            points.append(points_item)


        get_org_function_invocation_series_result = cls(
            days=days,
            buckets=buckets,
            functions=functions,
            points=points,
        )


        get_org_function_invocation_series_result.additional_properties = d
        return get_org_function_invocation_series_result

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
