from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.send_mail_batch_response_200_data_results_item_error_details import SendMailBatchResponse200DataResultsItemErrorDetails





T = TypeVar("T", bound="SendMailBatchResponse200DataResultsItemError")



@_attrs_define
class SendMailBatchResponse200DataResultsItemError:
    """ 
        Attributes:
            code (str):
            message (str):
            details (SendMailBatchResponse200DataResultsItemErrorDetails | Unset): Structured detail for the error, when
                there is any. On the replay of a stored failure it carries the replay signal.
     """

    code: str
    message: str
    details: SendMailBatchResponse200DataResultsItemErrorDetails | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.send_mail_batch_response_200_data_results_item_error_details import SendMailBatchResponse200DataResultsItemErrorDetails # noqa: PLC0415
        code = self.code

        message = self.message

        details: dict[str, Any] | Unset = UNSET
        if not isinstance(self.details, Unset):
            details = self.details.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "code": code,
            "message": message,
        })
        if details is not UNSET:
            field_dict["details"] = details

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.send_mail_batch_response_200_data_results_item_error_details import SendMailBatchResponse200DataResultsItemErrorDetails # noqa: PLC0415
        d = dict(src_dict)
        code = d.pop("code")

        message = d.pop("message")

        _details = d.pop("details", UNSET)
        details: SendMailBatchResponse200DataResultsItemErrorDetails | Unset
        if isinstance(_details,  Unset):
            details = UNSET
        else:
            details = SendMailBatchResponse200DataResultsItemErrorDetails.from_dict(_details)




        send_mail_batch_response_200_data_results_item_error = cls(
            code=code,
            message=message,
            details=details,
        )


        send_mail_batch_response_200_data_results_item_error.additional_properties = d
        return send_mail_batch_response_200_data_results_item_error

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
