from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_email_rule_request_result_tree_version import GetEmailRuleRequestResultTreeVersion
from typing import cast

if TYPE_CHECKING:
  from ..models.get_email_rule_request_result_tree_when import GetEmailRuleRequestResultTreeWhen





T = TypeVar("T", bound="GetEmailRuleRequestResultTree")



@_attrs_define
class GetEmailRuleRequestResultTree:
    """ 
        Attributes:
            version (GetEmailRuleRequestResultTreeVersion):
            vocabulary (str): The column contract version the rule is written against, for example v1.
            when (GetEmailRuleRequestResultTreeWhen): The rule's conditions: a condition ({column, op, value?,
                min_confidence?}) or a group ({all: [...]}, {any: [...]} or {not: ...}).
            questions (list[str]): Yes/no questions of the rule's own, asked about an email only after its conditions match.
                An email matches only if every answer is yes.
     """

    version: GetEmailRuleRequestResultTreeVersion
    vocabulary: str
    when: GetEmailRuleRequestResultTreeWhen
    questions: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_email_rule_request_result_tree_when import GetEmailRuleRequestResultTreeWhen # noqa: PLC0415
        version = self.version.value

        vocabulary = self.vocabulary

        when = self.when.to_dict()

        questions = self.questions




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "version": version,
            "vocabulary": vocabulary,
            "when": when,
            "questions": questions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_email_rule_request_result_tree_when import GetEmailRuleRequestResultTreeWhen # noqa: PLC0415
        d = dict(src_dict)
        version = GetEmailRuleRequestResultTreeVersion(d.pop("version"))




        vocabulary = d.pop("vocabulary")

        when = GetEmailRuleRequestResultTreeWhen.from_dict(d.pop("when"))




        questions = cast(list[str], d.pop("questions"))


        get_email_rule_request_result_tree = cls(
            version=version,
            vocabulary=vocabulary,
            when=when,
            questions=questions,
        )


        get_email_rule_request_result_tree.additional_properties = d
        return get_email_rule_request_result_tree

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
