from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_result_expectations_results_item_expected import TestEmailRuleResultExpectationsResultsItemExpected
from ..models.test_email_rule_result_expectations_results_item_outcome import TestEmailRuleResultExpectationsResultsItemOutcome
from ..models.test_email_rule_result_expectations_results_item_status import TestEmailRuleResultExpectationsResultsItemStatus
from uuid import UUID






T = TypeVar("T", bound="TestEmailRuleResultExpectationsResultsItem")



@_attrs_define
class TestEmailRuleResultExpectationsResultsItem:
    """ 
        Attributes:
            email_id (UUID):
            expected (TestEmailRuleResultExpectationsResultsItemExpected):
            outcome (TestEmailRuleResultExpectationsResultsItemOutcome):
            status (TestEmailRuleResultExpectationsResultsItemStatus):
     """

    email_id: UUID
    expected: TestEmailRuleResultExpectationsResultsItemExpected
    outcome: TestEmailRuleResultExpectationsResultsItemOutcome
    status: TestEmailRuleResultExpectationsResultsItemStatus
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        email_id = str(self.email_id)

        expected = self.expected.value

        outcome = self.outcome.value

        status = self.status.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "email_id": email_id,
            "expected": expected,
            "outcome": outcome,
            "status": status,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email_id = UUID(d.pop("email_id"))




        expected = TestEmailRuleResultExpectationsResultsItemExpected(d.pop("expected"))




        outcome = TestEmailRuleResultExpectationsResultsItemOutcome(d.pop("outcome"))




        status = TestEmailRuleResultExpectationsResultsItemStatus(d.pop("status"))




        test_email_rule_result_expectations_results_item = cls(
            email_id=email_id,
            expected=expected,
            outcome=outcome,
            status=status,
        )


        test_email_rule_result_expectations_results_item.additional_properties = d
        return test_email_rule_result_expectations_results_item

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
