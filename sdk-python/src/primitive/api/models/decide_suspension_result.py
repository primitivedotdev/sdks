from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.decide_suspension_result_decision import DecideSuspensionResultDecision
from typing import cast

if TYPE_CHECKING:
  from ..models.decide_suspension_result_function_stopped import DecideSuspensionResultFunctionStopped





T = TypeVar("T", bound="DecideSuspensionResult")



@_attrs_define
class DecideSuspensionResult:
    """ 
        Attributes:
            id (str):
            decision (DecideSuspensionResultDecision):
            function_stopped (DecideSuspensionResultFunctionStopped | Unset):
     """

    id: str
    decision: DecideSuspensionResultDecision
    function_stopped: DecideSuspensionResultFunctionStopped | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.decide_suspension_result_function_stopped import DecideSuspensionResultFunctionStopped # noqa: PLC0415
        id = self.id

        decision = self.decision.value

        function_stopped: dict[str, Any] | Unset = UNSET
        if not isinstance(self.function_stopped, Unset):
            function_stopped = self.function_stopped.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "decision": decision,
        })
        if function_stopped is not UNSET:
            field_dict["function_stopped"] = function_stopped

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.decide_suspension_result_function_stopped import DecideSuspensionResultFunctionStopped # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        decision = DecideSuspensionResultDecision(d.pop("decision"))




        _function_stopped = d.pop("function_stopped", UNSET)
        function_stopped: DecideSuspensionResultFunctionStopped | Unset
        if isinstance(_function_stopped,  Unset):
            function_stopped = UNSET
        else:
            function_stopped = DecideSuspensionResultFunctionStopped.from_dict(_function_stopped)




        decide_suspension_result = cls(
            id=id,
            decision=decision,
            function_stopped=function_stopped,
        )


        decide_suspension_result.additional_properties = d
        return decide_suspension_result

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
