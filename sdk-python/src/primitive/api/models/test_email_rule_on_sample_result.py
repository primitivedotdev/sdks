from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_on_sample_result_outcome import TestEmailRuleOnSampleResultOutcome
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.test_email_rule_on_sample_result_classification import TestEmailRuleOnSampleResultClassification
  from ..models.test_email_rule_on_sample_result_facts import TestEmailRuleOnSampleResultFacts
  from ..models.test_email_rule_on_sample_result_parts_item import TestEmailRuleOnSampleResultPartsItem
  from ..models.test_email_rule_on_sample_result_question_answers_item import TestEmailRuleOnSampleResultQuestionAnswersItem
  from ..models.test_email_rule_on_sample_result_rule import TestEmailRuleOnSampleResultRule
  from ..models.test_email_rule_on_sample_result_values import TestEmailRuleOnSampleResultValues





T = TypeVar("T", bound="TestEmailRuleOnSampleResult")



@_attrs_define
class TestEmailRuleOnSampleResult:
    """ 
        Attributes:
            rule (TestEmailRuleOnSampleResultRule):
            received_at (datetime.datetime): When the made-up email counts as received (now): a rule on received_at is
                decided on it.
            outcome (TestEmailRuleOnSampleResultOutcome): near_miss: Not matched, but nearly: its questions did not all say
                yes, or it needs several parts and exactly one failed while at least one part that held is not an exclusion (a
                top-level not, or is_false).
            parts (list[TestEmailRuleOnSampleResultPartsItem]): How each top-level part of the rule decided.
            question_answers (list[TestEmailRuleOnSampleResultQuestionAnswersItem]):
            classification (TestEmailRuleOnSampleResultClassification): Whether the email was classified; without a
                classification, a rule that reads a fact does not match.
            facts (TestEmailRuleOnSampleResultFacts): What the classifier read from the email, by fact: its value and
                confidence.
            missing_facts (list[str] | Unset): Facts the rule reads that this email's classification left out, so the rule
                did not match.
            values (TestEmailRuleOnSampleResultValues | Unset): By column the rule names: the value as its conditions
                compared it (a list cut at 50), and a fact's confidence. A fact left out reads null.
            unset_columns (list[str] | Unset): Email columns the rule reads that the made-up email left unset (spam_score
                without one), decided as no value.
     """

    rule: TestEmailRuleOnSampleResultRule
    received_at: datetime.datetime
    outcome: TestEmailRuleOnSampleResultOutcome
    parts: list[TestEmailRuleOnSampleResultPartsItem]
    question_answers: list[TestEmailRuleOnSampleResultQuestionAnswersItem]
    classification: TestEmailRuleOnSampleResultClassification
    facts: TestEmailRuleOnSampleResultFacts
    missing_facts: list[str] | Unset = UNSET
    values: TestEmailRuleOnSampleResultValues | Unset = UNSET
    unset_columns: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_on_sample_result_classification import TestEmailRuleOnSampleResultClassification # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_facts import TestEmailRuleOnSampleResultFacts # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_parts_item import TestEmailRuleOnSampleResultPartsItem # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_question_answers_item import TestEmailRuleOnSampleResultQuestionAnswersItem # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_rule import TestEmailRuleOnSampleResultRule # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_values import TestEmailRuleOnSampleResultValues # noqa: PLC0415
        rule = self.rule.to_dict()

        received_at = self.received_at.isoformat()

        outcome = self.outcome.value

        parts = []
        for parts_item_data in self.parts:
            parts_item = parts_item_data.to_dict()
            parts.append(parts_item)



        question_answers = []
        for question_answers_item_data in self.question_answers:
            question_answers_item = question_answers_item_data.to_dict()
            question_answers.append(question_answers_item)



        classification = self.classification.to_dict()

        facts = self.facts.to_dict()

        missing_facts: list[str] | Unset = UNSET
        if not isinstance(self.missing_facts, Unset):
            missing_facts = self.missing_facts



        values: dict[str, Any] | Unset = UNSET
        if not isinstance(self.values, Unset):
            values = self.values.to_dict()

        unset_columns: list[str] | Unset = UNSET
        if not isinstance(self.unset_columns, Unset):
            unset_columns = self.unset_columns




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rule": rule,
            "received_at": received_at,
            "outcome": outcome,
            "parts": parts,
            "question_answers": question_answers,
            "classification": classification,
            "facts": facts,
        })
        if missing_facts is not UNSET:
            field_dict["missing_facts"] = missing_facts
        if values is not UNSET:
            field_dict["values"] = values
        if unset_columns is not UNSET:
            field_dict["unset_columns"] = unset_columns

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_on_sample_result_classification import TestEmailRuleOnSampleResultClassification # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_facts import TestEmailRuleOnSampleResultFacts # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_parts_item import TestEmailRuleOnSampleResultPartsItem # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_question_answers_item import TestEmailRuleOnSampleResultQuestionAnswersItem # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_rule import TestEmailRuleOnSampleResultRule # noqa: PLC0415
        from ..models.test_email_rule_on_sample_result_values import TestEmailRuleOnSampleResultValues # noqa: PLC0415
        d = dict(src_dict)
        rule = TestEmailRuleOnSampleResultRule.from_dict(d.pop("rule"))




        received_at = datetime.datetime.fromisoformat(d.pop("received_at"))




        outcome = TestEmailRuleOnSampleResultOutcome(d.pop("outcome"))




        parts = []
        _parts = d.pop("parts")
        for parts_item_data in (_parts):
            parts_item = TestEmailRuleOnSampleResultPartsItem.from_dict(parts_item_data)



            parts.append(parts_item)


        question_answers = []
        _question_answers = d.pop("question_answers")
        for question_answers_item_data in (_question_answers):
            question_answers_item = TestEmailRuleOnSampleResultQuestionAnswersItem.from_dict(question_answers_item_data)



            question_answers.append(question_answers_item)


        classification = TestEmailRuleOnSampleResultClassification.from_dict(d.pop("classification"))




        facts = TestEmailRuleOnSampleResultFacts.from_dict(d.pop("facts"))




        missing_facts = cast(list[str], d.pop("missing_facts", UNSET))


        _values = d.pop("values", UNSET)
        values: TestEmailRuleOnSampleResultValues | Unset
        if isinstance(_values,  Unset):
            values = UNSET
        else:
            values = TestEmailRuleOnSampleResultValues.from_dict(_values)




        unset_columns = cast(list[str], d.pop("unset_columns", UNSET))


        test_email_rule_on_sample_result = cls(
            rule=rule,
            received_at=received_at,
            outcome=outcome,
            parts=parts,
            question_answers=question_answers,
            classification=classification,
            facts=facts,
            missing_facts=missing_facts,
            values=values,
            unset_columns=unset_columns,
        )


        test_email_rule_on_sample_result.additional_properties = d
        return test_email_rule_on_sample_result

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
