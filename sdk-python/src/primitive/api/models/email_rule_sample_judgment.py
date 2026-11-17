from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_sample_judgment_expected import EmailRuleSampleJudgmentExpected
from ..models.email_rule_sample_judgment_group import EmailRuleSampleJudgmentGroup
from ..models.email_rule_sample_judgment_outcome import EmailRuleSampleJudgmentOutcome
from ..models.email_rule_sample_judgment_reason import EmailRuleSampleJudgmentReason
from ..models.email_rule_sample_judgment_status import EmailRuleSampleJudgmentStatus
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_sample_judgment_question_answers_item import EmailRuleSampleJudgmentQuestionAnswersItem





T = TypeVar("T", bound="EmailRuleSampleJudgment")



@_attrs_define
class EmailRuleSampleJudgment:
    """ 
        Attributes:
            index (int):
            sample_id (None | UUID):
            label (None | str):
            expected (EmailRuleSampleJudgmentExpected):
            outcome (EmailRuleSampleJudgmentOutcome):
            status (EmailRuleSampleJudgmentStatus):
            close_call (bool): Passed or failed on an answer below 0.75 confidence, so asking again (a new version, or any
                judgment of a made-up email) may decide it the other way. Never for one its conditions alone decided.
            question_answers (list[EmailRuleSampleJudgmentQuestionAnswersItem]):
            group (EmailRuleSampleJudgmentGroup | Unset): Its group, when sent with one.
            reason (EmailRuleSampleJudgmentReason | Unset): On an undecided one only: why.
            retryable (bool | Unset): On an undecided one only: whether judging it again can decide it.
     """

    index: int
    sample_id: None | UUID
    label: None | str
    expected: EmailRuleSampleJudgmentExpected
    outcome: EmailRuleSampleJudgmentOutcome
    status: EmailRuleSampleJudgmentStatus
    close_call: bool
    question_answers: list[EmailRuleSampleJudgmentQuestionAnswersItem]
    group: EmailRuleSampleJudgmentGroup | Unset = UNSET
    reason: EmailRuleSampleJudgmentReason | Unset = UNSET
    retryable: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_sample_judgment_question_answers_item import EmailRuleSampleJudgmentQuestionAnswersItem # noqa: PLC0415
        index = self.index

        sample_id: None | str
        if isinstance(self.sample_id, UUID):
            sample_id = str(self.sample_id)
        else:
            sample_id = self.sample_id

        label: None | str
        label = self.label

        expected = self.expected.value

        outcome = self.outcome.value

        status = self.status.value

        close_call = self.close_call

        question_answers = []
        for question_answers_item_data in self.question_answers:
            question_answers_item = question_answers_item_data.to_dict()
            question_answers.append(question_answers_item)



        group: str | Unset = UNSET
        if not isinstance(self.group, Unset):
            group = self.group.value


        reason: str | Unset = UNSET
        if not isinstance(self.reason, Unset):
            reason = self.reason.value


        retryable = self.retryable


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "index": index,
            "sample_id": sample_id,
            "label": label,
            "expected": expected,
            "outcome": outcome,
            "status": status,
            "close_call": close_call,
            "question_answers": question_answers,
        })
        if group is not UNSET:
            field_dict["group"] = group
        if reason is not UNSET:
            field_dict["reason"] = reason
        if retryable is not UNSET:
            field_dict["retryable"] = retryable

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_sample_judgment_question_answers_item import EmailRuleSampleJudgmentQuestionAnswersItem # noqa: PLC0415
        d = dict(src_dict)
        index = d.pop("index")

        def _parse_sample_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sample_id_type_0 = UUID(data)



                return sample_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        sample_id = _parse_sample_id(d.pop("sample_id"))


        def _parse_label(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        label = _parse_label(d.pop("label"))


        expected = EmailRuleSampleJudgmentExpected(d.pop("expected"))




        outcome = EmailRuleSampleJudgmentOutcome(d.pop("outcome"))




        status = EmailRuleSampleJudgmentStatus(d.pop("status"))




        close_call = d.pop("close_call")

        question_answers = []
        _question_answers = d.pop("question_answers")
        for question_answers_item_data in (_question_answers):
            question_answers_item = EmailRuleSampleJudgmentQuestionAnswersItem.from_dict(question_answers_item_data)



            question_answers.append(question_answers_item)


        _group = d.pop("group", UNSET)
        group: EmailRuleSampleJudgmentGroup | Unset
        if isinstance(_group,  Unset):
            group = UNSET
        else:
            group = EmailRuleSampleJudgmentGroup(_group)




        _reason = d.pop("reason", UNSET)
        reason: EmailRuleSampleJudgmentReason | Unset
        if isinstance(_reason,  Unset):
            reason = UNSET
        else:
            reason = EmailRuleSampleJudgmentReason(_reason)




        retryable = d.pop("retryable", UNSET)

        email_rule_sample_judgment = cls(
            index=index,
            sample_id=sample_id,
            label=label,
            expected=expected,
            outcome=outcome,
            status=status,
            close_call=close_call,
            question_answers=question_answers,
            group=group,
            reason=reason,
            retryable=retryable,
        )


        email_rule_sample_judgment.additional_properties = d
        return email_rule_sample_judgment

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
