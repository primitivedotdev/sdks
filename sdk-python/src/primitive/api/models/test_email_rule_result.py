from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_scope_warning import EmailRuleScopeWarning
  from ..models.test_email_rule_result_classification import TestEmailRuleResultClassification
  from ..models.test_email_rule_result_counts import TestEmailRuleResultCounts
  from ..models.test_email_rule_result_expectations import TestEmailRuleResultExpectations
  from ..models.test_email_rule_result_questions import TestEmailRuleResultQuestions
  from ..models.test_email_rule_result_results_item import TestEmailRuleResultResultsItem
  from ..models.test_email_rule_result_rule import TestEmailRuleResultRule
  from ..models.test_email_rule_result_summary import TestEmailRuleResultSummary
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
            results (list[TestEmailRuleResultResultsItem]): Newest first; ids not found (email_ids, then expected ones)
                follow in the order given.
            summary (TestEmailRuleResultSummary | Unset):
            scope_warnings (list[EmailRuleScopeWarning] | Unset): Names in scope_selection that match nothing this
                organization receives mail at (a typo, or an inbox not yet in use). Present only when there are some.
            expectations (TestEmailRuleResultExpectations | Unset): Present when expect was given, or for a saved rule with
                saved expectations or made-up emails.
     """

    rule: TestEmailRuleResultRule
    window: TestEmailRuleResultWindow
    counts: TestEmailRuleResultCounts
    classification: TestEmailRuleResultClassification
    questions: TestEmailRuleResultQuestions
    results: list[TestEmailRuleResultResultsItem]
    summary: TestEmailRuleResultSummary | Unset = UNSET
    scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
    expectations: TestEmailRuleResultExpectations | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
        from ..models.test_email_rule_result_classification import TestEmailRuleResultClassification # noqa: PLC0415
        from ..models.test_email_rule_result_counts import TestEmailRuleResultCounts # noqa: PLC0415
        from ..models.test_email_rule_result_expectations import TestEmailRuleResultExpectations # noqa: PLC0415
        from ..models.test_email_rule_result_questions import TestEmailRuleResultQuestions # noqa: PLC0415
        from ..models.test_email_rule_result_results_item import TestEmailRuleResultResultsItem # noqa: PLC0415
        from ..models.test_email_rule_result_rule import TestEmailRuleResultRule # noqa: PLC0415
        from ..models.test_email_rule_result_summary import TestEmailRuleResultSummary # noqa: PLC0415
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



        summary: dict[str, Any] | Unset = UNSET
        if not isinstance(self.summary, Unset):
            summary = self.summary.to_dict()

        scope_warnings: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.scope_warnings, Unset):
            scope_warnings = []
            for scope_warnings_item_data in self.scope_warnings:
                scope_warnings_item = scope_warnings_item_data.to_dict()
                scope_warnings.append(scope_warnings_item)



        expectations: dict[str, Any] | Unset = UNSET
        if not isinstance(self.expectations, Unset):
            expectations = self.expectations.to_dict()


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
        if summary is not UNSET:
            field_dict["summary"] = summary
        if scope_warnings is not UNSET:
            field_dict["scope_warnings"] = scope_warnings
        if expectations is not UNSET:
            field_dict["expectations"] = expectations

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
        from ..models.test_email_rule_result_classification import TestEmailRuleResultClassification # noqa: PLC0415
        from ..models.test_email_rule_result_counts import TestEmailRuleResultCounts # noqa: PLC0415
        from ..models.test_email_rule_result_expectations import TestEmailRuleResultExpectations # noqa: PLC0415
        from ..models.test_email_rule_result_questions import TestEmailRuleResultQuestions # noqa: PLC0415
        from ..models.test_email_rule_result_results_item import TestEmailRuleResultResultsItem # noqa: PLC0415
        from ..models.test_email_rule_result_rule import TestEmailRuleResultRule # noqa: PLC0415
        from ..models.test_email_rule_result_summary import TestEmailRuleResultSummary # noqa: PLC0415
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


        _summary = d.pop("summary", UNSET)
        summary: TestEmailRuleResultSummary | Unset
        if isinstance(_summary,  Unset):
            summary = UNSET
        else:
            summary = TestEmailRuleResultSummary.from_dict(_summary)




        _scope_warnings = d.pop("scope_warnings", UNSET)
        scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
        if _scope_warnings is not UNSET:
            scope_warnings = []
            for scope_warnings_item_data in _scope_warnings:
                scope_warnings_item = EmailRuleScopeWarning.from_dict(scope_warnings_item_data)



                scope_warnings.append(scope_warnings_item)


        _expectations = d.pop("expectations", UNSET)
        expectations: TestEmailRuleResultExpectations | Unset
        if isinstance(_expectations,  Unset):
            expectations = UNSET
        else:
            expectations = TestEmailRuleResultExpectations.from_dict(_expectations)




        test_email_rule_result = cls(
            rule=rule,
            window=window,
            counts=counts,
            classification=classification,
            questions=questions,
            results=results,
            summary=summary,
            scope_warnings=scope_warnings,
            expectations=expectations,
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
