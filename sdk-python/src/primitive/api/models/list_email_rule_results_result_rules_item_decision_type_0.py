from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.list_email_rule_results_result_rules_item_decision_type_0_parts_item import ListEmailRuleResultsResultRulesItemDecisionType0PartsItem
  from ..models.list_email_rule_results_result_rules_item_decision_type_0_question_answers_item import ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem
  from ..models.list_email_rule_results_result_rules_item_decision_type_0_tree_type_0 import ListEmailRuleResultsResultRulesItemDecisionType0TreeType0





T = TypeVar("T", bound="ListEmailRuleResultsResultRulesItemDecisionType0")



@_attrs_define
class ListEmailRuleResultsResultRulesItemDecisionType0:
    """ What the rule most recently decided about this email; null when it has not run on it.

        Attributes:
            rule_version (int): The version of the rule that decided.
            matched (bool):
            parts (list[ListEmailRuleResultsResultRulesItemDecisionType0PartsItem]): How each top-level part of the rule
                decided. Empty when a fact the rule reads was missing, so it was not evaluated.
            question_answers (list[ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem]): The answers to the
                rule's own questions, asked only when its conditions matched.
            tree (ListEmailRuleResultsResultRulesItemDecisionType0TreeType0 | None): The conditions and questions of the
                version that decided, so the result reads in that version's words.
            created_at (datetime.datetime):
     """

    rule_version: int
    matched: bool
    parts: list[ListEmailRuleResultsResultRulesItemDecisionType0PartsItem]
    question_answers: list[ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem]
    tree: ListEmailRuleResultsResultRulesItemDecisionType0TreeType0 | None
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_parts_item import ListEmailRuleResultsResultRulesItemDecisionType0PartsItem # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_question_answers_item import ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_tree_type_0 import ListEmailRuleResultsResultRulesItemDecisionType0TreeType0 # noqa: PLC0415
        rule_version = self.rule_version

        matched = self.matched

        parts = []
        for parts_item_data in self.parts:
            parts_item = parts_item_data.to_dict()
            parts.append(parts_item)



        question_answers = []
        for question_answers_item_data in self.question_answers:
            question_answers_item = question_answers_item_data.to_dict()
            question_answers.append(question_answers_item)



        tree: dict[str, Any] | None
        if isinstance(self.tree, ListEmailRuleResultsResultRulesItemDecisionType0TreeType0):
            tree = self.tree.to_dict()
        else:
            tree = self.tree

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rule_version": rule_version,
            "matched": matched,
            "parts": parts,
            "question_answers": question_answers,
            "tree": tree,
            "created_at": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_parts_item import ListEmailRuleResultsResultRulesItemDecisionType0PartsItem # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_question_answers_item import ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_tree_type_0 import ListEmailRuleResultsResultRulesItemDecisionType0TreeType0 # noqa: PLC0415
        d = dict(src_dict)
        rule_version = d.pop("rule_version")

        matched = d.pop("matched")

        parts = []
        _parts = d.pop("parts")
        for parts_item_data in (_parts):
            parts_item = ListEmailRuleResultsResultRulesItemDecisionType0PartsItem.from_dict(parts_item_data)



            parts.append(parts_item)


        question_answers = []
        _question_answers = d.pop("question_answers")
        for question_answers_item_data in (_question_answers):
            question_answers_item = ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem.from_dict(question_answers_item_data)



            question_answers.append(question_answers_item)


        def _parse_tree(data: object) -> ListEmailRuleResultsResultRulesItemDecisionType0TreeType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                tree_type_0 = ListEmailRuleResultsResultRulesItemDecisionType0TreeType0.from_dict(data)



                return tree_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleResultsResultRulesItemDecisionType0TreeType0 | None, data)

        tree = _parse_tree(d.pop("tree"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        list_email_rule_results_result_rules_item_decision_type_0 = cls(
            rule_version=rule_version,
            matched=matched,
            parts=parts,
            question_answers=question_answers,
            tree=tree,
            created_at=created_at,
        )


        list_email_rule_results_result_rules_item_decision_type_0.additional_properties = d
        return list_email_rule_results_result_rules_item_decision_type_0

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
