from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_on_sample_request_evaluation_scope import TestEmailRuleOnSampleRequestEvaluationScope
from ..models.test_email_rule_on_sample_request_kind import TestEmailRuleOnSampleRequestKind
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_scope_selection import EmailRuleScopeSelection
  from ..models.email_rule_tree_input import EmailRuleTreeInput
  from ..models.test_email_rule_on_sample_request_email import TestEmailRuleOnSampleRequestEmail





T = TypeVar("T", bound="TestEmailRuleOnSampleRequest")



@_attrs_define
class TestEmailRuleOnSampleRequest:
    """ 
        Attributes:
            email (TestEmailRuleOnSampleRequestEmail): A made-up received email. Nothing about it is stored.
            tree (EmailRuleTreeInput | Unset):
            evaluation_scope (TestEmailRuleOnSampleRequestEvaluationScope | Unset): own_mailboxes (the default): mail to
                your own addresses and agents (for a rule that shares, those mail:share_own lets you share). author: all you can
                read, inboxes added later included. selected: what scope_selection names.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
            rule_id (UUID | Unset): A saved rule you can see, or one that covers your mailboxes (as you; dashboard or
                Primitive CLI only). Its current version is tested.
            kind (TestEmailRuleOnSampleRequestKind | Unset): For an unsaved tree: do_not_share tests it as a rule that
                blocks sharing, so an email it cannot decide counts as matched. A saved rule uses its own.
     """

    email: TestEmailRuleOnSampleRequestEmail
    tree: EmailRuleTreeInput | Unset = UNSET
    evaluation_scope: TestEmailRuleOnSampleRequestEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET
    rule_id: UUID | Unset = UNSET
    kind: TestEmailRuleOnSampleRequestKind | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        from ..models.test_email_rule_on_sample_request_email import TestEmailRuleOnSampleRequestEmail # noqa: PLC0415
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

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value



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
        if kind is not UNSET:
            field_dict["kind"] = kind

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        from ..models.test_email_rule_on_sample_request_email import TestEmailRuleOnSampleRequestEmail # noqa: PLC0415
        d = dict(src_dict)
        email = TestEmailRuleOnSampleRequestEmail.from_dict(d.pop("email"))




        _tree = d.pop("tree", UNSET)
        tree: EmailRuleTreeInput | Unset
        if isinstance(_tree,  Unset):
            tree = UNSET
        else:
            tree = EmailRuleTreeInput.from_dict(_tree)




        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: TestEmailRuleOnSampleRequestEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = TestEmailRuleOnSampleRequestEvaluationScope(_evaluation_scope)




        _scope_selection = d.pop("scope_selection", UNSET)
        scope_selection: EmailRuleScopeSelection | Unset
        if isinstance(_scope_selection,  Unset):
            scope_selection = UNSET
        else:
            scope_selection = EmailRuleScopeSelection.from_dict(_scope_selection)




        _rule_id = d.pop("rule_id", UNSET)
        rule_id: UUID | Unset
        if isinstance(_rule_id,  Unset):
            rule_id = UNSET
        else:
            rule_id = UUID(_rule_id)




        _kind = d.pop("kind", UNSET)
        kind: TestEmailRuleOnSampleRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = TestEmailRuleOnSampleRequestKind(_kind)




        test_email_rule_on_sample_request = cls(
            email=email,
            tree=tree,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            rule_id=rule_id,
            kind=kind,
        )

        return test_email_rule_on_sample_request

