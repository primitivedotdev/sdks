from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="GetOrgFunctionInvocationSeriesResultPointsItem")



@_attrs_define
class GetOrgFunctionInvocationSeriesResultPointsItem:
    """ 
        Attributes:
            day (str):
            function_id (UUID):
            invocations (float):
            failed (float):
     """

    day: str
    function_id: UUID
    invocations: float
    failed: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        day = self.day

        function_id = str(self.function_id)

        invocations = self.invocations

        failed = self.failed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "day": day,
            "function_id": function_id,
            "invocations": invocations,
            "failed": failed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        day = d.pop("day")

        function_id = UUID(d.pop("function_id"))




        invocations = d.pop("invocations")

        failed = d.pop("failed")

        get_org_function_invocation_series_result_points_item = cls(
            day=day,
            function_id=function_id,
            invocations=invocations,
            failed=failed,
        )


        get_org_function_invocation_series_result_points_item.additional_properties = d
        return get_org_function_invocation_series_result_points_item

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
