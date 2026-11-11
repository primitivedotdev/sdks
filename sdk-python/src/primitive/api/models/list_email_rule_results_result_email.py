from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListEmailRuleResultsResultEmail")



@_attrs_define
class ListEmailRuleResultsResultEmail:
    """ The email these results are about, so a saved answer says which one it was.

        Attributes:
            id (UUID):
            from_address (None | str): The sender address, as GET /v1/emails/{id} shows it.
            recipient (str): The mailbox this copy of the email was received in, as GET /v1/emails/{id} shows it.
            subject (None | str):
            received_at (datetime.datetime):
     """

    id: UUID
    from_address: None | str
    recipient: str
    subject: None | str
    received_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        from_address: None | str
        from_address = self.from_address

        recipient = self.recipient

        subject: None | str
        subject = self.subject

        received_at = self.received_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "from_address": from_address,
            "recipient": recipient,
            "subject": subject,
            "received_at": received_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_from_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_address = _parse_from_address(d.pop("from_address"))


        recipient = d.pop("recipient")

        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))


        received_at = datetime.datetime.fromisoformat(d.pop("received_at"))




        list_email_rule_results_result_email = cls(
            id=id,
            from_address=from_address,
            recipient=recipient,
            subject=subject,
            received_at=received_at,
        )


        list_email_rule_results_result_email.additional_properties = d
        return list_email_rule_results_result_email

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
