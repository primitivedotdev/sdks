from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="ListEmailRuleShareEmailsResultItemHighlightsType0")



@_attrs_define
class ListEmailRuleShareEmailsResultItemHighlightsType0:
    """ 
        Attributes:
            subject (list[str]):
            body (list[str]):
     """

    subject: list[str]
    body: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        subject = self.subject



        body = self.body




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "subject": subject,
            "body": body,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        subject = cast(list[str], d.pop("subject"))


        body = cast(list[str], d.pop("body"))


        list_email_rule_share_emails_result_item_highlights_type_0 = cls(
            subject=subject,
            body=body,
        )


        list_email_rule_share_emails_result_item_highlights_type_0.additional_properties = d
        return list_email_rule_share_emails_result_item_highlights_type_0

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
