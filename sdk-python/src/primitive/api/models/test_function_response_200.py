from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.test_invocation_result import TestInvocationResult





T = TypeVar("T", bound="TestFunctionResponse200")



@_attrs_define
class TestFunctionResponse200:
    """ 
        Attributes:
            success (bool):
            data (TestInvocationResult | Unset): Metadata returned by POST /functions/{id}/test. The send is
                queued; the actual invocation lands on the function's
                invocations list a few seconds later as the inbound mail
                traverses the MX path.
     """

    success: bool
    data: TestInvocationResult | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_invocation_result import TestInvocationResult
        success = self.success

        data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.data, Unset):
            data = self.data.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
        })
        if data is not UNSET:
            field_dict["data"] = data

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_invocation_result import TestInvocationResult
        d = dict(src_dict)
        success = d.pop("success")

        _data = d.pop("data", UNSET)
        data: TestInvocationResult | Unset
        if isinstance(_data,  Unset):
            data = UNSET
        else:
            data = TestInvocationResult.from_dict(_data)




        test_function_response_200 = cls(
            success=success,
            data=data,
        )


        test_function_response_200.additional_properties = d
        return test_function_response_200

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
