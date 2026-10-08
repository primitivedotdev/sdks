from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="EmailDetailRelayType0DeliveryItem")



@_attrs_define
class EmailDetailRelayType0DeliveryItem:
    """ 
        Attributes:
            recipient (str): The recipient address the relay forwarded to.
            status (str): Outcome of the forward. Currently one of `delivered`, `deferred` or `bounced`. Treat an unfamiliar
                value as one added after your client was built.
            at (datetime.datetime): When this outcome was recorded.
            smtp_code (int | None | Unset): SMTP reply code from the mailbox provider, when one was received.
            enhanced_status_code (None | str | Unset): Enhanced status code (for example `2.0.0`) from the mailbox provider,
                when one was received.
            smtp_response (None | str | Unset): SMTP reply text from the mailbox provider, when one was received.
     """

    recipient: str
    status: str
    at: datetime.datetime
    smtp_code: int | None | Unset = UNSET
    enhanced_status_code: None | str | Unset = UNSET
    smtp_response: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        recipient = self.recipient

        status = self.status

        at = self.at.isoformat()

        smtp_code: int | None | Unset
        if isinstance(self.smtp_code, Unset):
            smtp_code = UNSET
        else:
            smtp_code = self.smtp_code

        enhanced_status_code: None | str | Unset
        if isinstance(self.enhanced_status_code, Unset):
            enhanced_status_code = UNSET
        else:
            enhanced_status_code = self.enhanced_status_code

        smtp_response: None | str | Unset
        if isinstance(self.smtp_response, Unset):
            smtp_response = UNSET
        else:
            smtp_response = self.smtp_response


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "recipient": recipient,
            "status": status,
            "at": at,
        })
        if smtp_code is not UNSET:
            field_dict["smtp_code"] = smtp_code
        if enhanced_status_code is not UNSET:
            field_dict["enhanced_status_code"] = enhanced_status_code
        if smtp_response is not UNSET:
            field_dict["smtp_response"] = smtp_response

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        recipient = d.pop("recipient")

        status = d.pop("status")

        at = datetime.datetime.fromisoformat(d.pop("at"))




        def _parse_smtp_code(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        smtp_code = _parse_smtp_code(d.pop("smtp_code", UNSET))


        def _parse_enhanced_status_code(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        enhanced_status_code = _parse_enhanced_status_code(d.pop("enhanced_status_code", UNSET))


        def _parse_smtp_response(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        smtp_response = _parse_smtp_response(d.pop("smtp_response", UNSET))


        email_detail_relay_type_0_delivery_item = cls(
            recipient=recipient,
            status=status,
            at=at,
            smtp_code=smtp_code,
            enhanced_status_code=enhanced_status_code,
            smtp_response=smtp_response,
        )


        email_detail_relay_type_0_delivery_item.additional_properties = d
        return email_detail_relay_type_0_delivery_item

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
