from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.test_email_rule_result_summary_conditions_item import TestEmailRuleResultSummaryConditionsItem
  from ..models.test_email_rule_result_summary_questions_item import TestEmailRuleResultSummaryQuestionsItem





T = TypeVar("T", bound="TestEmailRuleResultSummary")



@_attrs_define
class TestEmailRuleResultSummary:
    """ 
        Attributes:
            decided (int): Emails decided on their conditions: matched, near_miss and no_match, less any missing a fact the
                rule reads.
            conditions (list[TestEmailRuleResultSummaryConditionsItem]): Each top-level condition (its parts index) in plain
                English, and how many decided emails it held on, failed on, and (except in an any rule) was the only failure on.
            questions (list[TestEmailRuleResultSummaryQuestionsItem]): Each question's answers on the emails whose
                conditions held.
            warnings (list[str]): What to look at first, such as what stopped every email when nothing matched.
     """

    decided: int
    conditions: list[TestEmailRuleResultSummaryConditionsItem]
    questions: list[TestEmailRuleResultSummaryQuestionsItem]
    warnings: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_result_summary_conditions_item import TestEmailRuleResultSummaryConditionsItem # noqa: PLC0415
        from ..models.test_email_rule_result_summary_questions_item import TestEmailRuleResultSummaryQuestionsItem # noqa: PLC0415
        decided = self.decided

        conditions = []
        for conditions_item_data in self.conditions:
            conditions_item = conditions_item_data.to_dict()
            conditions.append(conditions_item)



        questions = []
        for questions_item_data in self.questions:
            questions_item = questions_item_data.to_dict()
            questions.append(questions_item)



        warnings = self.warnings




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "decided": decided,
            "conditions": conditions,
            "questions": questions,
            "warnings": warnings,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_result_summary_conditions_item import TestEmailRuleResultSummaryConditionsItem # noqa: PLC0415
        from ..models.test_email_rule_result_summary_questions_item import TestEmailRuleResultSummaryQuestionsItem # noqa: PLC0415
        d = dict(src_dict)
        decided = d.pop("decided")

        conditions = []
        _conditions = d.pop("conditions")
        for conditions_item_data in (_conditions):
            conditions_item = TestEmailRuleResultSummaryConditionsItem.from_dict(conditions_item_data)



            conditions.append(conditions_item)


        questions = []
        _questions = d.pop("questions")
        for questions_item_data in (_questions):
            questions_item = TestEmailRuleResultSummaryQuestionsItem.from_dict(questions_item_data)



            questions.append(questions_item)


        warnings = cast(list[str], d.pop("warnings"))


        test_email_rule_result_summary = cls(
            decided=decided,
            conditions=conditions,
            questions=questions,
            warnings=warnings,
        )


        test_email_rule_result_summary.additional_properties = d
        return test_email_rule_result_summary

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
