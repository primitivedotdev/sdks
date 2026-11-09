from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_request_evaluation_scope import TestEmailRuleRequestEvaluationScope
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.test_email_rule_request_tree import TestEmailRuleRequestTree





T = TypeVar("T", bound="TestEmailRuleRequest")



@_attrs_define
class TestEmailRuleRequest:
    """ 
        Attributes:
            tree (TestEmailRuleRequestTree | Unset): An unsaved rule tree, as POST /email-rules/compile returned it. Give
                tree or rule_id, not both.
            evaluation_scope (TestEmailRuleRequestEvaluationScope | Unset): Whose mail an unsaved tree runs over. author,
                the default: all the mail you can read. own_mailboxes: only mail to your own addresses. Only with tree: a saved
                rule uses its own.
            rule_id (UUID | Unset): A saved rule you can see. Its current version is tested, with its author's access.
            email_ids (list[UUID] | Unset): Test exactly these emails. Without it, the newest emails the rule can read are
                tested, at most 200 and none older than 30 days.
            classify_missing (bool | Unset): Classify emails in the set that have not been classified yet and arrived more
                than 2 hours ago, and save their classification. Defaults to true. Newer ones are left to the normal
                classification and reported pending. The rule is never evaluated on them for real.
     """

    tree: TestEmailRuleRequestTree | Unset = UNSET
    evaluation_scope: TestEmailRuleRequestEvaluationScope | Unset = UNSET
    rule_id: UUID | Unset = UNSET
    email_ids: list[UUID] | Unset = UNSET
    classify_missing: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_request_tree import TestEmailRuleRequestTree # noqa: PLC0415
        tree: dict[str, Any] | Unset = UNSET
        if not isinstance(self.tree, Unset):
            tree = self.tree.to_dict()

        evaluation_scope: str | Unset = UNSET
        if not isinstance(self.evaluation_scope, Unset):
            evaluation_scope = self.evaluation_scope.value


        rule_id: str | Unset = UNSET
        if not isinstance(self.rule_id, Unset):
            rule_id = str(self.rule_id)

        email_ids: list[str] | Unset = UNSET
        if not isinstance(self.email_ids, Unset):
            email_ids = []
            for email_ids_item_data in self.email_ids:
                email_ids_item = str(email_ids_item_data)
                email_ids.append(email_ids_item)



        classify_missing = self.classify_missing


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if tree is not UNSET:
            field_dict["tree"] = tree
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if rule_id is not UNSET:
            field_dict["rule_id"] = rule_id
        if email_ids is not UNSET:
            field_dict["email_ids"] = email_ids
        if classify_missing is not UNSET:
            field_dict["classify_missing"] = classify_missing

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_request_tree import TestEmailRuleRequestTree # noqa: PLC0415
        d = dict(src_dict)
        _tree = d.pop("tree", UNSET)
        tree: TestEmailRuleRequestTree | Unset
        if isinstance(_tree,  Unset):
            tree = UNSET
        else:
            tree = TestEmailRuleRequestTree.from_dict(_tree)




        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: TestEmailRuleRequestEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = TestEmailRuleRequestEvaluationScope(_evaluation_scope)




        _rule_id = d.pop("rule_id", UNSET)
        rule_id: UUID | Unset
        if isinstance(_rule_id,  Unset):
            rule_id = UNSET
        else:
            rule_id = UUID(_rule_id)




        _email_ids = d.pop("email_ids", UNSET)
        email_ids: list[UUID] | Unset = UNSET
        if _email_ids is not UNSET:
            email_ids = []
            for email_ids_item_data in _email_ids:
                email_ids_item = UUID(email_ids_item_data)



                email_ids.append(email_ids_item)


        classify_missing = d.pop("classify_missing", UNSET)

        test_email_rule_request = cls(
            tree=tree,
            evaluation_scope=evaluation_scope,
            rule_id=rule_id,
            email_ids=email_ids,
            classify_missing=classify_missing,
        )

        return test_email_rule_request

