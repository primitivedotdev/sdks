from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_saved_sample_email_from import EmailRuleSavedSampleEmailFrom





T = TypeVar("T", bound="EmailRuleSavedSampleEmail")



@_attrs_define
class EmailRuleSavedSampleEmail:
    """ A made-up email, as POST /email-rules/test-sample takes it.

        Attributes:
            from_ (EmailRuleSavedSampleEmailFrom):
            to (list[str]):
            text (str):
            cc (list[str] | Unset):
            subject (str | Unset):
            attachment_types (list[str] | Unset):
            attachment_names (list[str] | Unset):
            automated (bool | Unset):
            from_mailing_list (bool | Unset):
            spam_score (float | Unset):
     """

    from_: EmailRuleSavedSampleEmailFrom
    to: list[str]
    text: str
    cc: list[str] | Unset = UNSET
    subject: str | Unset = UNSET
    attachment_types: list[str] | Unset = UNSET
    attachment_names: list[str] | Unset = UNSET
    automated: bool | Unset = UNSET
    from_mailing_list: bool | Unset = UNSET
    spam_score: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_saved_sample_email_from import EmailRuleSavedSampleEmailFrom # noqa: PLC0415
        from_ = self.from_.to_dict()

        to = self.to



        text = self.text

        cc: list[str] | Unset = UNSET
        if not isinstance(self.cc, Unset):
            cc = self.cc



        subject = self.subject

        attachment_types: list[str] | Unset = UNSET
        if not isinstance(self.attachment_types, Unset):
            attachment_types = self.attachment_types



        attachment_names: list[str] | Unset = UNSET
        if not isinstance(self.attachment_names, Unset):
            attachment_names = self.attachment_names



        automated = self.automated

        from_mailing_list = self.from_mailing_list

        spam_score = self.spam_score


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "from": from_,
            "to": to,
            "text": text,
        })
        if cc is not UNSET:
            field_dict["cc"] = cc
        if subject is not UNSET:
            field_dict["subject"] = subject
        if attachment_types is not UNSET:
            field_dict["attachment_types"] = attachment_types
        if attachment_names is not UNSET:
            field_dict["attachment_names"] = attachment_names
        if automated is not UNSET:
            field_dict["automated"] = automated
        if from_mailing_list is not UNSET:
            field_dict["from_mailing_list"] = from_mailing_list
        if spam_score is not UNSET:
            field_dict["spam_score"] = spam_score

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_saved_sample_email_from import EmailRuleSavedSampleEmailFrom # noqa: PLC0415
        d = dict(src_dict)
        from_ = EmailRuleSavedSampleEmailFrom.from_dict(d.pop("from"))




        to = cast(list[str], d.pop("to"))


        text = d.pop("text")

        cc = cast(list[str], d.pop("cc", UNSET))


        subject = d.pop("subject", UNSET)

        attachment_types = cast(list[str], d.pop("attachment_types", UNSET))


        attachment_names = cast(list[str], d.pop("attachment_names", UNSET))


        automated = d.pop("automated", UNSET)

        from_mailing_list = d.pop("from_mailing_list", UNSET)

        spam_score = d.pop("spam_score", UNSET)

        email_rule_saved_sample_email = cls(
            from_=from_,
            to=to,
            text=text,
            cc=cc,
            subject=subject,
            attachment_types=attachment_types,
            attachment_names=attachment_names,
            automated=automated,
            from_mailing_list=from_mailing_list,
            spam_score=spam_score,
        )


        email_rule_saved_sample_email.additional_properties = d
        return email_rule_saved_sample_email

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
