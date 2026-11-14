from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="TestEmailRuleOnSampleResultQuestionAnswersItem")



@_attrs_define
class TestEmailRuleOnSampleResultQuestionAnswersItem:
    """ 
        Attributes:
            question (str):
            answer (bool | None):
            probability (float | None): Deprecated: read confidence. The chance the answer is yes.
            confidence (float | None | Unset): How sure the answer is, from 0 to 1: the chance of the answer given, as
                webhook payloads carry it. Null when unanswered.
            error_class (str | Unset):
     """

    question: str
    answer: bool | None
    probability: float | None
    confidence: float | None | Unset = UNSET
    error_class: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        question = self.question

        answer: bool | None
        answer = self.answer

        probability: float | None
        probability = self.probability

        confidence: float | None | Unset
        if isinstance(self.confidence, Unset):
            confidence = UNSET
        else:
            confidence = self.confidence

        error_class = self.error_class


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "question": question,
            "answer": answer,
            "probability": probability,
        })
        if confidence is not UNSET:
            field_dict["confidence"] = confidence
        if error_class is not UNSET:
            field_dict["error_class"] = error_class

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        question = d.pop("question")

        def _parse_answer(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        answer = _parse_answer(d.pop("answer"))


        def _parse_probability(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        probability = _parse_probability(d.pop("probability"))


        def _parse_confidence(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        confidence = _parse_confidence(d.pop("confidence", UNSET))


        error_class = d.pop("error_class", UNSET)

        test_email_rule_on_sample_result_question_answers_item = cls(
            question=question,
            answer=answer,
            probability=probability,
            confidence=confidence,
            error_class=error_class,
        )


        test_email_rule_on_sample_result_question_answers_item.additional_properties = d
        return test_email_rule_on_sample_result_question_answers_item

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
