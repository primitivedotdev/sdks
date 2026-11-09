from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.send_mail_batch_response_200_data_results_item_error import SendMailBatchResponse200DataResultsItemError
  from ..models.send_mail_result import SendMailResult





T = TypeVar("T", bound="SendMailBatchResponse200DataResultsItem")



@_attrs_define
class SendMailBatchResponse200DataResultsItem:
    """ 
        Attributes:
            index (int): Zero-based position of this message in the request array.
            success (bool):
            data (SendMailResult | Unset):
            error (SendMailBatchResponse200DataResultsItemError | Unset):
     """

    index: int
    success: bool
    data: SendMailResult | Unset = UNSET
    error: SendMailBatchResponse200DataResultsItemError | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.send_mail_batch_response_200_data_results_item_error import SendMailBatchResponse200DataResultsItemError # noqa: PLC0415
        from ..models.send_mail_result import SendMailResult # noqa: PLC0415
        index = self.index

        success = self.success

        data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.data, Unset):
            data = self.data.to_dict()

        error: dict[str, Any] | Unset = UNSET
        if not isinstance(self.error, Unset):
            error = self.error.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "index": index,
            "success": success,
        })
        if data is not UNSET:
            field_dict["data"] = data
        if error is not UNSET:
            field_dict["error"] = error

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.send_mail_batch_response_200_data_results_item_error import SendMailBatchResponse200DataResultsItemError # noqa: PLC0415
        from ..models.send_mail_result import SendMailResult # noqa: PLC0415
        d = dict(src_dict)
        index = d.pop("index")

        success = d.pop("success")

        _data = d.pop("data", UNSET)
        data: SendMailResult | Unset
        if isinstance(_data,  Unset):
            data = UNSET
        else:
            data = SendMailResult.from_dict(_data)




        _error = d.pop("error", UNSET)
        error: SendMailBatchResponse200DataResultsItemError | Unset
        if isinstance(_error,  Unset):
            error = UNSET
        else:
            error = SendMailBatchResponse200DataResultsItemError.from_dict(_error)




        send_mail_batch_response_200_data_results_item = cls(
            index=index,
            success=success,
            data=data,
            error=error,
        )


        send_mail_batch_response_200_data_results_item.additional_properties = d
        return send_mail_batch_response_200_data_results_item

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
