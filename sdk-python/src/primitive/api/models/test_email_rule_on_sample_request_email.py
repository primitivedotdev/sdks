from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.test_email_rule_on_sample_request_email_from import TestEmailRuleOnSampleRequestEmailFrom





T = TypeVar("T", bound="TestEmailRuleOnSampleRequestEmail")



@_attrs_define
class TestEmailRuleOnSampleRequestEmail:
    """ A made-up received email. Nothing about it is stored.

        Attributes:
            from_ (TestEmailRuleOnSampleRequestEmailFrom):
            to (list[str]): The recipients; the first is read as the mailbox it arrived in.
            text (str): The body, as plain text.
            cc (list[str] | Unset):
            subject (str | Unset):
            attachment_types (list[str] | Unset): Content types of attachments the email carries, such as application/pdf.
                No attachment content.
            automated (bool | Unset): Whether the email was sent automatically, as its headers would show. Defaults to
                false.
            from_mailing_list (bool | Unset): Whether the email came from a mailing list, as its headers would show.
                Defaults to false.
            spam_score (float | Unset): The spam score the inbound filter would give it. Without one, a rule that reads
                spam_score decides on no score and the answer lists it in unset_columns.
     """

    from_: TestEmailRuleOnSampleRequestEmailFrom
    to: list[str]
    text: str
    cc: list[str] | Unset = UNSET
    subject: str | Unset = UNSET
    attachment_types: list[str] | Unset = UNSET
    automated: bool | Unset = UNSET
    from_mailing_list: bool | Unset = UNSET
    spam_score: float | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_on_sample_request_email_from import TestEmailRuleOnSampleRequestEmailFrom # noqa: PLC0415
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



        automated = self.automated

        from_mailing_list = self.from_mailing_list

        spam_score = self.spam_score


        field_dict: dict[str, Any] = {}

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
        if automated is not UNSET:
            field_dict["automated"] = automated
        if from_mailing_list is not UNSET:
            field_dict["from_mailing_list"] = from_mailing_list
        if spam_score is not UNSET:
            field_dict["spam_score"] = spam_score

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_on_sample_request_email_from import TestEmailRuleOnSampleRequestEmailFrom # noqa: PLC0415
        d = dict(src_dict)
        from_ = TestEmailRuleOnSampleRequestEmailFrom.from_dict(d.pop("from"))




        to = cast(list[str], d.pop("to"))


        text = d.pop("text")

        cc = cast(list[str], d.pop("cc", UNSET))


        subject = d.pop("subject", UNSET)

        attachment_types = cast(list[str], d.pop("attachment_types", UNSET))


        automated = d.pop("automated", UNSET)

        from_mailing_list = d.pop("from_mailing_list", UNSET)

        spam_score = d.pop("spam_score", UNSET)

        test_email_rule_on_sample_request_email = cls(
            from_=from_,
            to=to,
            text=text,
            cc=cc,
            subject=subject,
            attachment_types=attachment_types,
            automated=automated,
            from_mailing_list=from_mailing_list,
            spam_score=spam_score,
        )

        return test_email_rule_on_sample_request_email

