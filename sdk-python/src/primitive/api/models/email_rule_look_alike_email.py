from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_look_alike_email_from import EmailRuleLookAlikeEmailFrom





T = TypeVar("T", bound="EmailRuleLookAlikeEmail")



@_attrs_define
class EmailRuleLookAlikeEmail:
    """ A made-up email, as test-sample takes it.

        Attributes:
            from_ (EmailRuleLookAlikeEmailFrom):
            to (list[str]):
            cc (list[str]):
            subject (str):
            text (str):
            attachment_types (list[str]):
            automated (bool):
            from_mailing_list (bool):
     """

    from_: EmailRuleLookAlikeEmailFrom
    to: list[str]
    cc: list[str]
    subject: str
    text: str
    attachment_types: list[str]
    automated: bool
    from_mailing_list: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_look_alike_email_from import EmailRuleLookAlikeEmailFrom # noqa: PLC0415
        from_ = self.from_.to_dict()

        to = self.to



        cc = self.cc



        subject = self.subject

        text = self.text

        attachment_types = self.attachment_types



        automated = self.automated

        from_mailing_list = self.from_mailing_list


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "from": from_,
            "to": to,
            "cc": cc,
            "subject": subject,
            "text": text,
            "attachment_types": attachment_types,
            "automated": automated,
            "from_mailing_list": from_mailing_list,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_look_alike_email_from import EmailRuleLookAlikeEmailFrom # noqa: PLC0415
        d = dict(src_dict)
        from_ = EmailRuleLookAlikeEmailFrom.from_dict(d.pop("from"))




        to = cast(list[str], d.pop("to"))


        cc = cast(list[str], d.pop("cc"))


        subject = d.pop("subject")

        text = d.pop("text")

        attachment_types = cast(list[str], d.pop("attachment_types"))


        automated = d.pop("automated")

        from_mailing_list = d.pop("from_mailing_list")

        email_rule_look_alike_email = cls(
            from_=from_,
            to=to,
            cc=cc,
            subject=subject,
            text=text,
            attachment_types=attachment_types,
            automated=automated,
            from_mailing_list=from_mailing_list,
        )


        email_rule_look_alike_email.additional_properties = d
        return email_rule_look_alike_email

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
