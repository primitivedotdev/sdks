from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_email_rule_share_emails_result_item_relay_type_0_delivery_item_status import ListEmailRuleShareEmailsResultItemRelayType0DeliveryItemStatus
from typing import cast






T = TypeVar("T", bound="ListEmailRuleShareEmailsResultItemRelayType0DeliveryItem")



@_attrs_define
class ListEmailRuleShareEmailsResultItemRelayType0DeliveryItem:
    """ 
        Attributes:
            recipient (str):
            status (ListEmailRuleShareEmailsResultItemRelayType0DeliveryItemStatus):
            smtp_code (int | None):
            enhanced_status_code (None | str):
            smtp_response (str):
            at (str):
     """

    recipient: str
    status: ListEmailRuleShareEmailsResultItemRelayType0DeliveryItemStatus
    smtp_code: int | None
    enhanced_status_code: None | str
    smtp_response: str
    at: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        recipient = self.recipient

        status = self.status.value

        smtp_code: int | None
        smtp_code = self.smtp_code

        enhanced_status_code: None | str
        enhanced_status_code = self.enhanced_status_code

        smtp_response = self.smtp_response

        at = self.at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "recipient": recipient,
            "status": status,
            "smtp_code": smtp_code,
            "enhanced_status_code": enhanced_status_code,
            "smtp_response": smtp_response,
            "at": at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        recipient = d.pop("recipient")

        status = ListEmailRuleShareEmailsResultItemRelayType0DeliveryItemStatus(d.pop("status"))




        def _parse_smtp_code(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        smtp_code = _parse_smtp_code(d.pop("smtp_code"))


        def _parse_enhanced_status_code(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        enhanced_status_code = _parse_enhanced_status_code(d.pop("enhanced_status_code"))


        smtp_response = d.pop("smtp_response")

        at = d.pop("at")

        list_email_rule_share_emails_result_item_relay_type_0_delivery_item = cls(
            recipient=recipient,
            status=status,
            smtp_code=smtp_code,
            enhanced_status_code=enhanced_status_code,
            smtp_response=smtp_response,
            at=at,
        )


        list_email_rule_share_emails_result_item_relay_type_0_delivery_item.additional_properties = d
        return list_email_rule_share_emails_result_item_relay_type_0_delivery_item

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
