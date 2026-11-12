from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_look_alike_expected import EmailRuleLookAlikeExpected
from ..models.email_rule_look_alike_kind import EmailRuleLookAlikeKind
from ..models.email_rule_look_alike_outcome import EmailRuleLookAlikeOutcome
from ..models.email_rule_look_alike_status import EmailRuleLookAlikeStatus
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_look_alike_email import EmailRuleLookAlikeEmail
  from ..models.email_rule_look_alike_question_answers_item import EmailRuleLookAlikeQuestionAnswersItem





T = TypeVar("T", bound="EmailRuleLookAlike")



@_attrs_define
class EmailRuleLookAlike:
    """ 
        Attributes:
            kind (EmailRuleLookAlikeKind):
            expected (EmailRuleLookAlikeExpected): match: a near case the rule should match; no_match: one it should not.
            why (str): Why the rule should, or should not, match it.
            email (EmailRuleLookAlikeEmail): A made-up email, as test-sample takes it.
            outcome (EmailRuleLookAlikeOutcome):
            status (EmailRuleLookAlikeStatus): failed: the rule decided it against expected (shared one it should not, or
                missed one it should match). undecided: the rule reads a spam score, which it cannot carry, whatever it decided;
                or not matched on something it could not decide (not classified, a fact or answer missing, or not reached in
                time).
            question_answers (list[EmailRuleLookAlikeQuestionAnswersItem]):
     """

    kind: EmailRuleLookAlikeKind
    expected: EmailRuleLookAlikeExpected
    why: str
    email: EmailRuleLookAlikeEmail
    outcome: EmailRuleLookAlikeOutcome
    status: EmailRuleLookAlikeStatus
    question_answers: list[EmailRuleLookAlikeQuestionAnswersItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_look_alike_email import EmailRuleLookAlikeEmail # noqa: PLC0415
        from ..models.email_rule_look_alike_question_answers_item import EmailRuleLookAlikeQuestionAnswersItem # noqa: PLC0415
        kind = self.kind.value

        expected = self.expected.value

        why = self.why

        email = self.email.to_dict()

        outcome = self.outcome.value

        status = self.status.value

        question_answers = []
        for question_answers_item_data in self.question_answers:
            question_answers_item = question_answers_item_data.to_dict()
            question_answers.append(question_answers_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "expected": expected,
            "why": why,
            "email": email,
            "outcome": outcome,
            "status": status,
            "question_answers": question_answers,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_look_alike_email import EmailRuleLookAlikeEmail # noqa: PLC0415
        from ..models.email_rule_look_alike_question_answers_item import EmailRuleLookAlikeQuestionAnswersItem # noqa: PLC0415
        d = dict(src_dict)
        kind = EmailRuleLookAlikeKind(d.pop("kind"))




        expected = EmailRuleLookAlikeExpected(d.pop("expected"))




        why = d.pop("why")

        email = EmailRuleLookAlikeEmail.from_dict(d.pop("email"))




        outcome = EmailRuleLookAlikeOutcome(d.pop("outcome"))




        status = EmailRuleLookAlikeStatus(d.pop("status"))




        question_answers = []
        _question_answers = d.pop("question_answers")
        for question_answers_item_data in (_question_answers):
            question_answers_item = EmailRuleLookAlikeQuestionAnswersItem.from_dict(question_answers_item_data)



            question_answers.append(question_answers_item)


        email_rule_look_alike = cls(
            kind=kind,
            expected=expected,
            why=why,
            email=email,
            outcome=outcome,
            status=status,
            question_answers=question_answers,
        )


        email_rule_look_alike.additional_properties = d
        return email_rule_look_alike

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
