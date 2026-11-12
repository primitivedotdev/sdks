from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_sample_judgment import EmailRuleSampleJudgment
  from ..models.test_email_rule_result_expectations_counts import TestEmailRuleResultExpectationsCounts
  from ..models.test_email_rule_result_expectations_results_item import TestEmailRuleResultExpectationsResultsItem





T = TypeVar("T", bound="TestEmailRuleResultExpectations")



@_attrs_define
class TestEmailRuleResultExpectations:
    """ Present when expect was given, or for a saved rule with saved expectations or made-up emails.

        Attributes:
            passed (bool): Every expectation passed. One undecided is no pass: unclassified or a question unanswered (test
                again later), skipped (it cannot be tested), or not found (no such email the rule can read).
            counts (TestEmailRuleResultExpectationsCounts):
            results (list[TestEmailRuleResultExpectationsResultsItem]): match first, then no_match, each in the order given
                (saved expectations by email id).
            samples (list[EmailRuleSampleJudgment] | Unset): Made-up emails judged (expect.samples, or a saved rule's), in
                order; counts include them.
     """

    passed: bool
    counts: TestEmailRuleResultExpectationsCounts
    results: list[TestEmailRuleResultExpectationsResultsItem]
    samples: list[EmailRuleSampleJudgment] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_sample_judgment import EmailRuleSampleJudgment # noqa: PLC0415
        from ..models.test_email_rule_result_expectations_counts import TestEmailRuleResultExpectationsCounts # noqa: PLC0415
        from ..models.test_email_rule_result_expectations_results_item import TestEmailRuleResultExpectationsResultsItem # noqa: PLC0415
        passed = self.passed

        counts = self.counts.to_dict()

        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)



        samples: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.samples, Unset):
            samples = []
            for samples_item_data in self.samples:
                samples_item = samples_item_data.to_dict()
                samples.append(samples_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "passed": passed,
            "counts": counts,
            "results": results,
        })
        if samples is not UNSET:
            field_dict["samples"] = samples

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_sample_judgment import EmailRuleSampleJudgment # noqa: PLC0415
        from ..models.test_email_rule_result_expectations_counts import TestEmailRuleResultExpectationsCounts # noqa: PLC0415
        from ..models.test_email_rule_result_expectations_results_item import TestEmailRuleResultExpectationsResultsItem # noqa: PLC0415
        d = dict(src_dict)
        passed = d.pop("passed")

        counts = TestEmailRuleResultExpectationsCounts.from_dict(d.pop("counts"))




        results = []
        _results = d.pop("results")
        for results_item_data in (_results):
            results_item = TestEmailRuleResultExpectationsResultsItem.from_dict(results_item_data)



            results.append(results_item)


        _samples = d.pop("samples", UNSET)
        samples: list[EmailRuleSampleJudgment] | Unset = UNSET
        if _samples is not UNSET:
            samples = []
            for samples_item_data in _samples:
                samples_item = EmailRuleSampleJudgment.from_dict(samples_item_data)



                samples.append(samples_item)


        test_email_rule_result_expectations = cls(
            passed=passed,
            counts=counts,
            results=results,
            samples=samples,
        )


        test_email_rule_result_expectations.additional_properties = d
        return test_email_rule_result_expectations

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
