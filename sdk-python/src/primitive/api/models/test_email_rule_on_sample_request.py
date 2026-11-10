from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_on_sample_request_evaluation_scope import TestEmailRuleOnSampleRequestEvaluationScope
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.test_email_rule_on_sample_request_email import TestEmailRuleOnSampleRequestEmail
  from ..models.test_email_rule_on_sample_request_scope_selection import TestEmailRuleOnSampleRequestScopeSelection
  from ..models.test_email_rule_on_sample_request_tree import TestEmailRuleOnSampleRequestTree





T = TypeVar("T", bound="TestEmailRuleOnSampleRequest")



@_attrs_define
class TestEmailRuleOnSampleRequest:
    """ 
        Attributes:
            email (TestEmailRuleOnSampleRequestEmail): A made-up received email. Nothing about it is stored.
            tree (TestEmailRuleOnSampleRequestTree | Unset): An unsaved rule tree, as POST /email-rules/compile returned it.
                Give tree or rule_id, not both.
            evaluation_scope (TestEmailRuleOnSampleRequestEvaluationScope | Unset): author: all mail its author can read.
                own_mailboxes: mail to their own addresses. selected: what scope_selection names. Never more than the author can
                read.
            scope_selection (TestEmailRuleOnSampleRequestScopeSelection | Unset): Inboxes, and domains (every address at
                them the author can read), for a selected rule; each one you can read.
            rule_id (UUID | Unset): A saved rule you can see. Its current version is tested.
     """

    email: TestEmailRuleOnSampleRequestEmail
    tree: TestEmailRuleOnSampleRequestTree | Unset = UNSET
    evaluation_scope: TestEmailRuleOnSampleRequestEvaluationScope | Unset = UNSET
    scope_selection: TestEmailRuleOnSampleRequestScopeSelection | Unset = UNSET
    rule_id: UUID | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_on_sample_request_email import TestEmailRuleOnSampleRequestEmail # noqa: PLC0415
        from ..models.test_email_rule_on_sample_request_scope_selection import TestEmailRuleOnSampleRequestScopeSelection # noqa: PLC0415
        from ..models.test_email_rule_on_sample_request_tree import TestEmailRuleOnSampleRequestTree # noqa: PLC0415
        email = self.email.to_dict()

        tree: dict[str, Any] | Unset = UNSET
        if not isinstance(self.tree, Unset):
            tree = self.tree.to_dict()

        evaluation_scope: str | Unset = UNSET
        if not isinstance(self.evaluation_scope, Unset):
            evaluation_scope = self.evaluation_scope.value


        scope_selection: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scope_selection, Unset):
            scope_selection = self.scope_selection.to_dict()

        rule_id: str | Unset = UNSET
        if not isinstance(self.rule_id, Unset):
            rule_id = str(self.rule_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "email": email,
        })
        if tree is not UNSET:
            field_dict["tree"] = tree
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection
        if rule_id is not UNSET:
            field_dict["rule_id"] = rule_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_on_sample_request_email import TestEmailRuleOnSampleRequestEmail # noqa: PLC0415
        from ..models.test_email_rule_on_sample_request_scope_selection import TestEmailRuleOnSampleRequestScopeSelection # noqa: PLC0415
        from ..models.test_email_rule_on_sample_request_tree import TestEmailRuleOnSampleRequestTree # noqa: PLC0415
        d = dict(src_dict)
        email = TestEmailRuleOnSampleRequestEmail.from_dict(d.pop("email"))




        _tree = d.pop("tree", UNSET)
        tree: TestEmailRuleOnSampleRequestTree | Unset
        if isinstance(_tree,  Unset):
            tree = UNSET
        else:
            tree = TestEmailRuleOnSampleRequestTree.from_dict(_tree)




        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: TestEmailRuleOnSampleRequestEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = TestEmailRuleOnSampleRequestEvaluationScope(_evaluation_scope)




        _scope_selection = d.pop("scope_selection", UNSET)
        scope_selection: TestEmailRuleOnSampleRequestScopeSelection | Unset
        if isinstance(_scope_selection,  Unset):
            scope_selection = UNSET
        else:
            scope_selection = TestEmailRuleOnSampleRequestScopeSelection.from_dict(_scope_selection)




        _rule_id = d.pop("rule_id", UNSET)
        rule_id: UUID | Unset
        if isinstance(_rule_id,  Unset):
            rule_id = UNSET
        else:
            rule_id = UUID(_rule_id)




        test_email_rule_on_sample_request = cls(
            email=email,
            tree=tree,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            rule_id=rule_id,
        )

        return test_email_rule_on_sample_request

