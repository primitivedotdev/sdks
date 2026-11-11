from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_result_results_item_outcome import TestEmailRuleResultResultsItemOutcome
from ..models.test_email_rule_result_results_item_question_answers_source import TestEmailRuleResultResultsItemQuestionAnswersSource
from ..models.test_email_rule_result_results_item_skipped_reason import TestEmailRuleResultResultsItemSkippedReason
from ..models.test_email_rule_result_results_item_unclassified_reason import TestEmailRuleResultResultsItemUnclassifiedReason
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.test_email_rule_result_results_item_parts_item import TestEmailRuleResultResultsItemPartsItem
  from ..models.test_email_rule_result_results_item_question_answers_item import TestEmailRuleResultResultsItemQuestionAnswersItem
  from ..models.test_email_rule_result_results_item_values import TestEmailRuleResultResultsItemValues





T = TypeVar("T", bound="TestEmailRuleResultResultsItem")



@_attrs_define
class TestEmailRuleResultResultsItem:
    """ 
        Attributes:
            email_id (UUID):
            outcome (TestEmailRuleResultResultsItemOutcome): near_miss: Not matched, but nearly: its questions did not all
                say yes, or it needs several parts and exactly one failed while at least one part that held is not an exclusion
                (a top-level not, or is_false). skipped: an email you can see that cannot be tested; skipped_reason says why.
                not_found: no such email, or not one the rule can read (or not settled, or awaiting sender authentication).
            received_at (datetime.datetime | Unset):
            from_address (None | str | Unset):
            recipient (str | Unset): The mailbox this copy of the email was received in, as GET /v1/emails/{id} shows it.
                Given with received_at, from_address and subject, so absent for not_found.
            subject (None | str | Unset):
            parts (list[TestEmailRuleResultResultsItemPartsItem] | Unset): How each top-level part of the rule decided.
                Present for matched, near_miss and no_match.
            missing_facts (list[str] | Unset): Facts the rule reads that this email's classification left out, so the rule
                did not match.
            values (TestEmailRuleResultResultsItemValues | Unset): By column the rule names: the value as its conditions
                compared it (a list cut at 50), and a fact's confidence. A fact left out reads null.
            question_answers (list[TestEmailRuleResultResultsItemQuestionAnswersItem] | Unset): The answers to the rule's
                own questions, asked only when its conditions matched.
            question_answers_source (TestEmailRuleResultResultsItemQuestionAnswersSource | Unset): Where question_answers
                came from, when there are any. stored: a saved rule version's answers about this email, kept once given (by
                evaluation or an earlier test) or recorded with its decision, reused because answers are sampled and asking
                again can differ. asked_now: asked by this test (always, for an unsaved tree). not_asked: no call could be made;
                error_class says why.
            skipped_reason (TestEmailRuleResultResultsItemSkippedReason | Unset): Why a skipped email cannot be tested.
                unparsed: its content failed to parse, so it can never be classified. rejected: it was rejected and never
                delivered. content_discarded: its content has been discarded, or is being. Nothing is classified or asked about
                it and no stored answers are used, so it never counts as a pass. The recent window holds only mail that can be
                tested, apart from unparsed mail; an email you name is reported as skipped, whichever of these it is.
            unclassified_reason (TestEmailRuleResultResultsItemUnclassifiedReason | Unset): Why an unclassified email has no
                classification. pending: not reached before the test stopped, or not classified here (it arrived within the last
                2 hours and normal classification has not finished with it, or classify_missing was false); run the test again
                later.
     """

    email_id: UUID
    outcome: TestEmailRuleResultResultsItemOutcome
    received_at: datetime.datetime | Unset = UNSET
    from_address: None | str | Unset = UNSET
    recipient: str | Unset = UNSET
    subject: None | str | Unset = UNSET
    parts: list[TestEmailRuleResultResultsItemPartsItem] | Unset = UNSET
    missing_facts: list[str] | Unset = UNSET
    values: TestEmailRuleResultResultsItemValues | Unset = UNSET
    question_answers: list[TestEmailRuleResultResultsItemQuestionAnswersItem] | Unset = UNSET
    question_answers_source: TestEmailRuleResultResultsItemQuestionAnswersSource | Unset = UNSET
    skipped_reason: TestEmailRuleResultResultsItemSkippedReason | Unset = UNSET
    unclassified_reason: TestEmailRuleResultResultsItemUnclassifiedReason | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_result_results_item_parts_item import TestEmailRuleResultResultsItemPartsItem # noqa: PLC0415
        from ..models.test_email_rule_result_results_item_question_answers_item import TestEmailRuleResultResultsItemQuestionAnswersItem # noqa: PLC0415
        from ..models.test_email_rule_result_results_item_values import TestEmailRuleResultResultsItemValues # noqa: PLC0415
        email_id = str(self.email_id)

        outcome = self.outcome.value

        received_at: str | Unset = UNSET
        if not isinstance(self.received_at, Unset):
            received_at = self.received_at.isoformat()

        from_address: None | str | Unset
        if isinstance(self.from_address, Unset):
            from_address = UNSET
        else:
            from_address = self.from_address

        recipient = self.recipient

        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        parts: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.parts, Unset):
            parts = []
            for parts_item_data in self.parts:
                parts_item = parts_item_data.to_dict()
                parts.append(parts_item)



        missing_facts: list[str] | Unset = UNSET
        if not isinstance(self.missing_facts, Unset):
            missing_facts = self.missing_facts



        values: dict[str, Any] | Unset = UNSET
        if not isinstance(self.values, Unset):
            values = self.values.to_dict()

        question_answers: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.question_answers, Unset):
            question_answers = []
            for question_answers_item_data in self.question_answers:
                question_answers_item = question_answers_item_data.to_dict()
                question_answers.append(question_answers_item)



        question_answers_source: str | Unset = UNSET
        if not isinstance(self.question_answers_source, Unset):
            question_answers_source = self.question_answers_source.value


        skipped_reason: str | Unset = UNSET
        if not isinstance(self.skipped_reason, Unset):
            skipped_reason = self.skipped_reason.value


        unclassified_reason: str | Unset = UNSET
        if not isinstance(self.unclassified_reason, Unset):
            unclassified_reason = self.unclassified_reason.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "email_id": email_id,
            "outcome": outcome,
        })
        if received_at is not UNSET:
            field_dict["received_at"] = received_at
        if from_address is not UNSET:
            field_dict["from_address"] = from_address
        if recipient is not UNSET:
            field_dict["recipient"] = recipient
        if subject is not UNSET:
            field_dict["subject"] = subject
        if parts is not UNSET:
            field_dict["parts"] = parts
        if missing_facts is not UNSET:
            field_dict["missing_facts"] = missing_facts
        if values is not UNSET:
            field_dict["values"] = values
        if question_answers is not UNSET:
            field_dict["question_answers"] = question_answers
        if question_answers_source is not UNSET:
            field_dict["question_answers_source"] = question_answers_source
        if skipped_reason is not UNSET:
            field_dict["skipped_reason"] = skipped_reason
        if unclassified_reason is not UNSET:
            field_dict["unclassified_reason"] = unclassified_reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_result_results_item_parts_item import TestEmailRuleResultResultsItemPartsItem # noqa: PLC0415
        from ..models.test_email_rule_result_results_item_question_answers_item import TestEmailRuleResultResultsItemQuestionAnswersItem # noqa: PLC0415
        from ..models.test_email_rule_result_results_item_values import TestEmailRuleResultResultsItemValues # noqa: PLC0415
        d = dict(src_dict)
        email_id = UUID(d.pop("email_id"))




        outcome = TestEmailRuleResultResultsItemOutcome(d.pop("outcome"))




        _received_at = d.pop("received_at", UNSET)
        received_at: datetime.datetime | Unset
        if isinstance(_received_at,  Unset):
            received_at = UNSET
        else:
            received_at = datetime.datetime.fromisoformat(_received_at)




        def _parse_from_address(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        from_address = _parse_from_address(d.pop("from_address", UNSET))


        recipient = d.pop("recipient", UNSET)

        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        _parts = d.pop("parts", UNSET)
        parts: list[TestEmailRuleResultResultsItemPartsItem] | Unset = UNSET
        if _parts is not UNSET:
            parts = []
            for parts_item_data in _parts:
                parts_item = TestEmailRuleResultResultsItemPartsItem.from_dict(parts_item_data)



                parts.append(parts_item)


        missing_facts = cast(list[str], d.pop("missing_facts", UNSET))


        _values = d.pop("values", UNSET)
        values: TestEmailRuleResultResultsItemValues | Unset
        if isinstance(_values,  Unset):
            values = UNSET
        else:
            values = TestEmailRuleResultResultsItemValues.from_dict(_values)




        _question_answers = d.pop("question_answers", UNSET)
        question_answers: list[TestEmailRuleResultResultsItemQuestionAnswersItem] | Unset = UNSET
        if _question_answers is not UNSET:
            question_answers = []
            for question_answers_item_data in _question_answers:
                question_answers_item = TestEmailRuleResultResultsItemQuestionAnswersItem.from_dict(question_answers_item_data)



                question_answers.append(question_answers_item)


        _question_answers_source = d.pop("question_answers_source", UNSET)
        question_answers_source: TestEmailRuleResultResultsItemQuestionAnswersSource | Unset
        if isinstance(_question_answers_source,  Unset):
            question_answers_source = UNSET
        else:
            question_answers_source = TestEmailRuleResultResultsItemQuestionAnswersSource(_question_answers_source)




        _skipped_reason = d.pop("skipped_reason", UNSET)
        skipped_reason: TestEmailRuleResultResultsItemSkippedReason | Unset
        if isinstance(_skipped_reason,  Unset):
            skipped_reason = UNSET
        else:
            skipped_reason = TestEmailRuleResultResultsItemSkippedReason(_skipped_reason)




        _unclassified_reason = d.pop("unclassified_reason", UNSET)
        unclassified_reason: TestEmailRuleResultResultsItemUnclassifiedReason | Unset
        if isinstance(_unclassified_reason,  Unset):
            unclassified_reason = UNSET
        else:
            unclassified_reason = TestEmailRuleResultResultsItemUnclassifiedReason(_unclassified_reason)




        test_email_rule_result_results_item = cls(
            email_id=email_id,
            outcome=outcome,
            received_at=received_at,
            from_address=from_address,
            recipient=recipient,
            subject=subject,
            parts=parts,
            missing_facts=missing_facts,
            values=values,
            question_answers=question_answers,
            question_answers_source=question_answers_source,
            skipped_reason=skipped_reason,
            unclassified_reason=unclassified_reason,
        )


        test_email_rule_result_results_item.additional_properties = d
        return test_email_rule_result_results_item

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
