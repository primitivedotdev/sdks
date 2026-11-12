from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_tree_input_version import EmailRuleTreeInputVersion
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_tree_input_when import EmailRuleTreeInputWhen





T = TypeVar("T", bound="EmailRuleTreeInput")



@_attrs_define
class EmailRuleTreeInput:
    """ 
        Attributes:
            version (EmailRuleTreeInputVersion):
            vocabulary (str): Vocabulary version, such as v1.
            when (EmailRuleTreeInputWhen): A condition {column, op, value?, min_confidence?} (see GET /email-
                rules/vocabulary) or {all: [...]}, {any: [...]}, {not: ...}.
            questions (list[str] | Unset): Yes/no questions asked once the conditions match, over the email's text and
                attachment names, never attachment contents. A grant rule needs every one yes; a do_not_share rule matches on
                any yes. Left out, none.
     """

    version: EmailRuleTreeInputVersion
    vocabulary: str
    when: EmailRuleTreeInputWhen
    questions: list[str] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_tree_input_when import EmailRuleTreeInputWhen # noqa: PLC0415
        version = self.version.value

        vocabulary = self.vocabulary

        when = self.when.to_dict()

        questions: list[str] | Unset = UNSET
        if not isinstance(self.questions, Unset):
            questions = self.questions




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "version": version,
            "vocabulary": vocabulary,
            "when": when,
        })
        if questions is not UNSET:
            field_dict["questions"] = questions

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_tree_input_when import EmailRuleTreeInputWhen # noqa: PLC0415
        d = dict(src_dict)
        version = EmailRuleTreeInputVersion(d.pop("version"))




        vocabulary = d.pop("vocabulary")

        when = EmailRuleTreeInputWhen.from_dict(d.pop("when"))




        questions = cast(list[str], d.pop("questions", UNSET))


        email_rule_tree_input = cls(
            version=version,
            vocabulary=vocabulary,
            when=when,
            questions=questions,
        )

        return email_rule_tree_input

