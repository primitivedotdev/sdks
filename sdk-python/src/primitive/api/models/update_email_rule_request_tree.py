from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_email_rule_request_tree_version import UpdateEmailRuleRequestTreeVersion
from typing import cast

if TYPE_CHECKING:
  from ..models.update_email_rule_request_tree_when import UpdateEmailRuleRequestTreeWhen





T = TypeVar("T", bound="UpdateEmailRuleRequestTree")



@_attrs_define
class UpdateEmailRuleRequestTree:
    """ The rule tree. Checked against the column contract on save.

        Attributes:
            version (UpdateEmailRuleRequestTreeVersion):
            vocabulary (str): The column contract version the rule is written against, for example v1.
            when (UpdateEmailRuleRequestTreeWhen): The rule's conditions: a condition ({column, op, value?,
                min_confidence?}) or a group ({all: [...]}, {any: [...]} or {not: ...}).
            questions (list[str]): Yes/no questions of the rule's own, asked about an email only after its conditions match.
                An email matches only if every answer is yes.
     """

    version: UpdateEmailRuleRequestTreeVersion
    vocabulary: str
    when: UpdateEmailRuleRequestTreeWhen
    questions: list[str]





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_email_rule_request_tree_when import UpdateEmailRuleRequestTreeWhen # noqa: PLC0415
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
        from ..models.update_email_rule_request_tree_when import UpdateEmailRuleRequestTreeWhen # noqa: PLC0415
        d = dict(src_dict)
        version = UpdateEmailRuleRequestTreeVersion(d.pop("version"))




        vocabulary = d.pop("vocabulary")

        when = UpdateEmailRuleRequestTreeWhen.from_dict(d.pop("when"))




        questions = cast(list[str], d.pop("questions"))


        update_email_rule_request_tree = cls(
            version=version,
            vocabulary=vocabulary,
            when=when,
            questions=questions,
        )

        return update_email_rule_request_tree

