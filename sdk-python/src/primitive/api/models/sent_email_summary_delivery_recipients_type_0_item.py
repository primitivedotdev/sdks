from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.sent_email_summary_delivery_recipients_type_0_item_result import SentEmailSummaryDeliveryRecipientsType0ItemResult
from typing import cast






T = TypeVar("T", bound="SentEmailSummaryDeliveryRecipientsType0Item")



@_attrs_define
class SentEmailSummaryDeliveryRecipientsType0Item:
    """ 
        Attributes:
            address (str):
            result (SentEmailSummaryDeliveryRecipientsType0ItemResult):
            smtp_response_text (None | str):
            smtp_enhanced_status_code (None | str):
     """

    address: str
    result: SentEmailSummaryDeliveryRecipientsType0ItemResult
    smtp_response_text: None | str
    smtp_enhanced_status_code: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        result = self.result.value

        smtp_response_text: None | str
        smtp_response_text = self.smtp_response_text

        smtp_enhanced_status_code: None | str
        smtp_enhanced_status_code = self.smtp_enhanced_status_code


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "result": result,
            "smtp_response_text": smtp_response_text,
            "smtp_enhanced_status_code": smtp_enhanced_status_code,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        result = SentEmailSummaryDeliveryRecipientsType0ItemResult(d.pop("result"))




        def _parse_smtp_response_text(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        smtp_response_text = _parse_smtp_response_text(d.pop("smtp_response_text"))


        def _parse_smtp_enhanced_status_code(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        smtp_enhanced_status_code = _parse_smtp_enhanced_status_code(d.pop("smtp_enhanced_status_code"))


        sent_email_summary_delivery_recipients_type_0_item = cls(
            address=address,
            result=result,
            smtp_response_text=smtp_response_text,
            smtp_enhanced_status_code=smtp_enhanced_status_code,
        )


        sent_email_summary_delivery_recipients_type_0_item.additional_properties = d
        return sent_email_summary_delivery_recipients_type_0_item

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
