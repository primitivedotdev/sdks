from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_tree import EmailRuleTree
  from ..models.email_rule_withheld_by import EmailRuleWithheldBy
  from ..models.list_email_rule_results_result_rules_item_decision_type_0_parts_item import ListEmailRuleResultsResultRulesItemDecisionType0PartsItem
  from ..models.list_email_rule_results_result_rules_item_decision_type_0_question_answers_item import ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem





T = TypeVar("T", bound="ListEmailRuleResultsResultRulesItemDecisionType0")



@_attrs_define
class ListEmailRuleResultsResultRulesItemDecisionType0:
    """ What the rule most recently decided about this email; null when it has not run on it.

        Attributes:
            rule_version (int): The version of the rule that decided.
            matched (bool):
            parts (list[ListEmailRuleResultsResultRulesItemDecisionType0PartsItem]): How each top-level part of the rule
                decided. Empty when a fact the rule reads was missing, so it was not evaluated, or when detail_withheld is true.
            question_answers (list[ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem]): The answers to the
                rule's own questions, asked only when its conditions matched.
            tree (EmailRuleTree | None): The conditions and questions of the version that decided, so the result reads in
                that version's words.
            created_at (datetime.datetime):
            near_miss (bool | Unset): Not matched, but nearly: its questions did not all say yes, or it needs several parts
                and exactly one failed while at least one part that held is not an exclusion (a top-level not, or is_false).
                False when detail_withheld is true. Decisions recorded under the earlier definition counted an exclusion too.
            detail_withheld (bool | Unset): Present, as true, on a result for an email whose content cannot be read
                (withheld, failed to parse or discarded): matched still says what the rule decided, but how it got there was
                read from that content, so parts and question_answers are empty and near_miss is false. Absent otherwise.
            withheld_by (list[EmailRuleWithheldBy] | Unset): Set when do-not-share rules kept this match from being shared,
                so no key or webhook got it through the rule: those you can see, and why.
            withheld_by_hidden (int | Unset): With withheld_by: how many more kept it back that you cannot see, or that were
                deleted since. Those rules are not shown; an admin can see them.
     """

    rule_version: int
    matched: bool
    parts: list[ListEmailRuleResultsResultRulesItemDecisionType0PartsItem]
    question_answers: list[ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem]
    tree: EmailRuleTree | None
    created_at: datetime.datetime
    near_miss: bool | Unset = UNSET
    detail_withheld: bool | Unset = UNSET
    withheld_by: list[EmailRuleWithheldBy] | Unset = UNSET
    withheld_by_hidden: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        from ..models.email_rule_withheld_by import EmailRuleWithheldBy # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_parts_item import ListEmailRuleResultsResultRulesItemDecisionType0PartsItem # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_question_answers_item import ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem # noqa: PLC0415
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
        if isinstance(self.tree, EmailRuleTree):
            tree = self.tree.to_dict()
        else:
            tree = self.tree

        created_at = self.created_at.isoformat()

        near_miss = self.near_miss

        detail_withheld = self.detail_withheld

        withheld_by: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.withheld_by, Unset):
            withheld_by = []
            for withheld_by_item_data in self.withheld_by:
                withheld_by_item = withheld_by_item_data.to_dict()
                withheld_by.append(withheld_by_item)



        withheld_by_hidden = self.withheld_by_hidden


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
        if near_miss is not UNSET:
            field_dict["near_miss"] = near_miss
        if detail_withheld is not UNSET:
            field_dict["detail_withheld"] = detail_withheld
        if withheld_by is not UNSET:
            field_dict["withheld_by"] = withheld_by
        if withheld_by_hidden is not UNSET:
            field_dict["withheld_by_hidden"] = withheld_by_hidden

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        from ..models.email_rule_withheld_by import EmailRuleWithheldBy # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_parts_item import ListEmailRuleResultsResultRulesItemDecisionType0PartsItem # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0_question_answers_item import ListEmailRuleResultsResultRulesItemDecisionType0QuestionAnswersItem # noqa: PLC0415
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


        def _parse_tree(data: object) -> EmailRuleTree | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                tree_type_1 = EmailRuleTree.from_dict(data)



                return tree_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleTree | None, data)

        tree = _parse_tree(d.pop("tree"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        near_miss = d.pop("near_miss", UNSET)

        detail_withheld = d.pop("detail_withheld", UNSET)

        _withheld_by = d.pop("withheld_by", UNSET)
        withheld_by: list[EmailRuleWithheldBy] | Unset = UNSET
        if _withheld_by is not UNSET:
            withheld_by = []
            for withheld_by_item_data in _withheld_by:
                withheld_by_item = EmailRuleWithheldBy.from_dict(withheld_by_item_data)



                withheld_by.append(withheld_by_item)


        withheld_by_hidden = d.pop("withheld_by_hidden", UNSET)

        list_email_rule_results_result_rules_item_decision_type_0 = cls(
            rule_version=rule_version,
            matched=matched,
            parts=parts,
            question_answers=question_answers,
            tree=tree,
            created_at=created_at,
            near_miss=near_miss,
            detail_withheld=detail_withheld,
            withheld_by=withheld_by,
            withheld_by_hidden=withheld_by_hidden,
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
