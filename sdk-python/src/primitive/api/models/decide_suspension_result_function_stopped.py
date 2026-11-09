from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.decide_suspension_result_function_stopped_by import DecideSuspensionResultFunctionStoppedBy
from ..models.decide_suspension_result_function_stopped_stop_rank import DecideSuspensionResultFunctionStoppedStopRank






T = TypeVar("T", bound="DecideSuspensionResultFunctionStopped")



@_attrs_define
class DecideSuspensionResultFunctionStopped:
    """ 
        Attributes:
            by (DecideSuspensionResultFunctionStoppedBy):
            stop_rank (DecideSuspensionResultFunctionStoppedStopRank):
            message (str):
     """

    by: DecideSuspensionResultFunctionStoppedBy
    stop_rank: DecideSuspensionResultFunctionStoppedStopRank
    message: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        by = self.by.value

        stop_rank = self.stop_rank.value

        message = self.message


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "by": by,
            "stop_rank": stop_rank,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        by = DecideSuspensionResultFunctionStoppedBy(d.pop("by"))




        stop_rank = DecideSuspensionResultFunctionStoppedStopRank(d.pop("stop_rank"))




        message = d.pop("message")

        decide_suspension_result_function_stopped = cls(
            by=by,
            stop_rank=stop_rank,
            message=message,
        )


        decide_suspension_result_function_stopped.additional_properties = d
        return decide_suspension_result_function_stopped

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
