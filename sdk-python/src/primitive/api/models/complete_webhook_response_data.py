from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.complete_webhook_response_data_result import CompleteWebhookResponseDataResult






T = TypeVar("T", bound="CompleteWebhookResponseData")



@_attrs_define
class CompleteWebhookResponseData:
    """ 
        Attributes:
            result (CompleteWebhookResponseDataResult):
     """

    result: CompleteWebhookResponseDataResult





    def to_dict(self) -> dict[str, Any]:
        result = self.result.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "result": result,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        result = CompleteWebhookResponseDataResult(d.pop("result"))




        complete_webhook_response_data = cls(
            result=result,
        )

        return complete_webhook_response_data

