from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_summary_delivery_report_type_0_type import EmailSummaryDeliveryReportType0Type
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="EmailSummaryDeliveryReportType0")



@_attrs_define
class EmailSummaryDeliveryReportType0:
    """ Classified inbound delivery notification, or null. The linked sent_email_id is resolved within the receiving
    organization; null means uncorrelated. This is a reported outcome, not a rewrite of the original send status.
    Transient reports may still be retried. Optional for older payloads and other summary endpoints.

        Attributes:
            type_ (EmailSummaryDeliveryReportType0Type):
            sent_email_id (None | UUID):
            failed_recipients (list[str]):
            status_code (None | str):
            diagnostic (None | str):
     """

    type_: EmailSummaryDeliveryReportType0Type
    sent_email_id: None | UUID
    failed_recipients: list[str]
    status_code: None | str
    diagnostic: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        sent_email_id: None | str
        if isinstance(self.sent_email_id, UUID):
            sent_email_id = str(self.sent_email_id)
        else:
            sent_email_id = self.sent_email_id

        failed_recipients = self.failed_recipients



        status_code: None | str
        status_code = self.status_code

        diagnostic: None | str
        diagnostic = self.diagnostic


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "sent_email_id": sent_email_id,
            "failed_recipients": failed_recipients,
            "status_code": status_code,
            "diagnostic": diagnostic,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = EmailSummaryDeliveryReportType0Type(d.pop("type"))




        def _parse_sent_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sent_email_id_type_0 = UUID(data)



                return sent_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        sent_email_id = _parse_sent_email_id(d.pop("sent_email_id"))


        failed_recipients = cast(list[str], d.pop("failed_recipients"))


        def _parse_status_code(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        status_code = _parse_status_code(d.pop("status_code"))


        def _parse_diagnostic(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        diagnostic = _parse_diagnostic(d.pop("diagnostic"))


        email_summary_delivery_report_type_0 = cls(
            type_=type_,
            sent_email_id=sent_email_id,
            failed_recipients=failed_recipients,
            status_code=status_code,
            diagnostic=diagnostic,
        )


        email_summary_delivery_report_type_0.additional_properties = d
        return email_summary_delivery_report_type_0

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
