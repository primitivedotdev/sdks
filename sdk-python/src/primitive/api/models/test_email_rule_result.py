from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.test_email_rule_result_classification import TestEmailRuleResultClassification
  from ..models.test_email_rule_result_counts import TestEmailRuleResultCounts
  from ..models.test_email_rule_result_questions import TestEmailRuleResultQuestions
  from ..models.test_email_rule_result_results_item import TestEmailRuleResultResultsItem
  from ..models.test_email_rule_result_rule import TestEmailRuleResultRule
  from ..models.test_email_rule_result_window import TestEmailRuleResultWindow





T = TypeVar("T", bound="TestEmailRuleResult")



@_attrs_define
class TestEmailRuleResult:
    """ 
        Attributes:
            rule (TestEmailRuleResultRule):
            window (TestEmailRuleResultWindow):
            counts (TestEmailRuleResultCounts):
            classification (TestEmailRuleResultClassification):
            questions (TestEmailRuleResultQuestions):
            results (list[TestEmailRuleResultResultsItem]): Newest first; with email_ids, the ids not found follow in the
                order given.
     """

    rule: TestEmailRuleResultRule
    window: TestEmailRuleResultWindow
    counts: TestEmailRuleResultCounts
    classification: TestEmailRuleResultClassification
    questions: TestEmailRuleResultQuestions
    results: list[TestEmailRuleResultResultsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_result_classification import TestEmailRuleResultClassification # noqa: PLC0415
        from ..models.test_email_rule_result_counts import TestEmailRuleResultCounts # noqa: PLC0415
        from ..models.test_email_rule_result_questions import TestEmailRuleResultQuestions # noqa: PLC0415
        from ..models.test_email_rule_result_results_item import TestEmailRuleResultResultsItem # noqa: PLC0415
        from ..models.test_email_rule_result_rule import TestEmailRuleResultRule # noqa: PLC0415
        from ..models.test_email_rule_result_window import TestEmailRuleResultWindow # noqa: PLC0415
        rule = self.rule.to_dict()

        window = self.window.to_dict()

        counts = self.counts.to_dict()

        classification = self.classification.to_dict()

        questions = self.questions.to_dict()

        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rule": rule,
            "window": window,
            "counts": counts,
            "classification": classification,
            "questions": questions,
            "results": results,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_result_classification import TestEmailRuleResultClassification # noqa: PLC0415
        from ..models.test_email_rule_result_counts import TestEmailRuleResultCounts # noqa: PLC0415
        from ..models.test_email_rule_result_questions import TestEmailRuleResultQuestions # noqa: PLC0415
        from ..models.test_email_rule_result_results_item import TestEmailRuleResultResultsItem # noqa: PLC0415
        from ..models.test_email_rule_result_rule import TestEmailRuleResultRule # noqa: PLC0415
        from ..models.test_email_rule_result_window import TestEmailRuleResultWindow # noqa: PLC0415
        d = dict(src_dict)
        rule = TestEmailRuleResultRule.from_dict(d.pop("rule"))




        window = TestEmailRuleResultWindow.from_dict(d.pop("window"))




        counts = TestEmailRuleResultCounts.from_dict(d.pop("counts"))




        classification = TestEmailRuleResultClassification.from_dict(d.pop("classification"))




        questions = TestEmailRuleResultQuestions.from_dict(d.pop("questions"))




        results = []
        _results = d.pop("results")
        for results_item_data in (_results):
            results_item = TestEmailRuleResultResultsItem.from_dict(results_item_data)



            results.append(results_item)


        test_email_rule_result = cls(
            rule=rule,
            window=window,
            counts=counts,
            classification=classification,
            questions=questions,
            results=results,
        )


        test_email_rule_result.additional_properties = d
        return test_email_rule_result

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
