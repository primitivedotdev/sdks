from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_changed_emails_emails_item import EmailRuleChangedEmailsEmailsItem





T = TypeVar("T", bound="EmailRuleChangedEmails")



@_attrs_define
class EmailRuleChangedEmails:
    """ 
        Attributes:
            count (int):
            emails (list[EmailRuleChangedEmailsEmailsItem]): Newest first, at most 50; count is the full number.
     """

    count: int
    emails: list[EmailRuleChangedEmailsEmailsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_changed_emails_emails_item import EmailRuleChangedEmailsEmailsItem # noqa: PLC0415
        count = self.count

        emails = []
        for emails_item_data in self.emails:
            emails_item = emails_item_data.to_dict()
            emails.append(emails_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "count": count,
            "emails": emails,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_changed_emails_emails_item import EmailRuleChangedEmailsEmailsItem # noqa: PLC0415
        d = dict(src_dict)
        count = d.pop("count")

        emails = []
        _emails = d.pop("emails")
        for emails_item_data in (_emails):
            emails_item = EmailRuleChangedEmailsEmailsItem.from_dict(emails_item_data)



            emails.append(emails_item)


        email_rule_changed_emails = cls(
            count=count,
            emails=emails,
        )


        email_rule_changed_emails.additional_properties = d
        return email_rule_changed_emails

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
