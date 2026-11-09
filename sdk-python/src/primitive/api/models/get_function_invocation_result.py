from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.get_function_invocation_result_invocation import GetFunctionInvocationResultInvocation
  from ..models.get_function_invocation_result_logs_item import GetFunctionInvocationResultLogsItem





T = TypeVar("T", bound="GetFunctionInvocationResult")



@_attrs_define
class GetFunctionInvocationResult:
    """ 
        Attributes:
            invocation (GetFunctionInvocationResultInvocation):
            logs (list[GetFunctionInvocationResultLogsItem]):
            logs_truncated (bool):
     """

    invocation: GetFunctionInvocationResultInvocation
    logs: list[GetFunctionInvocationResultLogsItem]
    logs_truncated: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_function_invocation_result_invocation import GetFunctionInvocationResultInvocation # noqa: PLC0415
        from ..models.get_function_invocation_result_logs_item import GetFunctionInvocationResultLogsItem # noqa: PLC0415
        invocation = self.invocation.to_dict()

        logs = []
        for logs_item_data in self.logs:
            logs_item = logs_item_data.to_dict()
            logs.append(logs_item)



        logs_truncated = self.logs_truncated


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "invocation": invocation,
            "logs": logs,
            "logs_truncated": logs_truncated,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_function_invocation_result_invocation import GetFunctionInvocationResultInvocation # noqa: PLC0415
        from ..models.get_function_invocation_result_logs_item import GetFunctionInvocationResultLogsItem # noqa: PLC0415
        d = dict(src_dict)
        invocation = GetFunctionInvocationResultInvocation.from_dict(d.pop("invocation"))




        logs = []
        _logs = d.pop("logs")
        for logs_item_data in (_logs):
            logs_item = GetFunctionInvocationResultLogsItem.from_dict(logs_item_data)



            logs.append(logs_item)


        logs_truncated = d.pop("logs_truncated")

        get_function_invocation_result = cls(
            invocation=invocation,
            logs=logs,
            logs_truncated=logs_truncated,
        )


        get_function_invocation_result.additional_properties = d
        return get_function_invocation_result

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
