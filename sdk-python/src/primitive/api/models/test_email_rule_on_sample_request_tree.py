from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_on_sample_request_tree_version import TestEmailRuleOnSampleRequestTreeVersion
from typing import cast

if TYPE_CHECKING:
  from ..models.test_email_rule_on_sample_request_tree_when import TestEmailRuleOnSampleRequestTreeWhen





T = TypeVar("T", bound="TestEmailRuleOnSampleRequestTree")



@_attrs_define
class TestEmailRuleOnSampleRequestTree:
    """ An unsaved rule tree, as POST /email-rules/compile returned it. Give tree or rule_id, not both.

        Attributes:
            version (TestEmailRuleOnSampleRequestTreeVersion):
            vocabulary (str): The column contract version the rule is written against, for example v1.
            when (TestEmailRuleOnSampleRequestTreeWhen): The rule's conditions: a condition ({column, op, value?,
                min_confidence?}) or a group ({all: [...]}, {any: [...]} or {not: ...}).
            questions (list[str]): Yes/no questions of the rule's own, asked about an email only after its conditions match.
                An email matches only if every answer is yes.
     """

    version: TestEmailRuleOnSampleRequestTreeVersion
    vocabulary: str
    when: TestEmailRuleOnSampleRequestTreeWhen
    questions: list[str]





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_on_sample_request_tree_when import TestEmailRuleOnSampleRequestTreeWhen # noqa: PLC0415
        version = self.version.value

        vocabulary = self.vocabulary

        when = self.when.to_dict()

        questions = self.questions




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "version": version,
            "vocabulary": vocabulary,
            "when": when,
            "questions": questions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_on_sample_request_tree_when import TestEmailRuleOnSampleRequestTreeWhen # noqa: PLC0415
        d = dict(src_dict)
        version = TestEmailRuleOnSampleRequestTreeVersion(d.pop("version"))




        vocabulary = d.pop("vocabulary")

        when = TestEmailRuleOnSampleRequestTreeWhen.from_dict(d.pop("when"))




        questions = cast(list[str], d.pop("questions"))


        test_email_rule_on_sample_request_tree = cls(
            version=version,
            vocabulary=vocabulary,
            when=when,
            questions=questions,
        )

        return test_email_rule_on_sample_request_tree

