from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_request_evaluation_scope import TestEmailRuleRequestEvaluationScope
from ..models.test_email_rule_request_kind import TestEmailRuleRequestKind
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_scope_selection import EmailRuleScopeSelection
  from ..models.email_rule_tree_input import EmailRuleTreeInput
  from ..models.test_email_rule_request_expect import TestEmailRuleRequestExpect





T = TypeVar("T", bound="TestEmailRuleRequest")



@_attrs_define
class TestEmailRuleRequest:
    """ 
        Attributes:
            tree (EmailRuleTreeInput | Unset):
            evaluation_scope (TestEmailRuleRequestEvaluationScope | Unset): own_mailboxes (the default): mail to your own
                addresses and agents (for a rule that shares, those mail:share_own lets you share). author: all you can read,
                inboxes added later included. selected: what scope_selection names.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
            rule_id (UUID | Unset): A saved rule you can see. Its current version is tested, with its author's access.
            kind (TestEmailRuleRequestKind | Unset): For an unsaved tree: do_not_share tests it as a rule that blocks
                sharing, so an email it cannot decide counts as matched. A saved rule uses its own.
            email_ids (list[UUID] | Unset): Test exactly these emails, and any expected ones. Without it, the newest emails
                the rule can read are tested, at most 200 and none older than 30 days.
            classify_missing (bool | Unset): Classify emails in the set that have not been classified yet and arrived more
                than 2 hours ago, and save their classification. Defaults to true. Newer ones are left to the normal
                classification and reported pending. The rule is never evaluated on them for real.
            expect (TestEmailRuleRequestExpect | Unset): Emails the rule must match and must not, at most 100 in all, always
                tested whatever their age: added to email_ids, or to the recent window, which gives up a place for each. The
                answer's expectations judge each.
     """

    tree: EmailRuleTreeInput | Unset = UNSET
    evaluation_scope: TestEmailRuleRequestEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET
    rule_id: UUID | Unset = UNSET
    kind: TestEmailRuleRequestKind | Unset = UNSET
    email_ids: list[UUID] | Unset = UNSET
    classify_missing: bool | Unset = UNSET
    expect: TestEmailRuleRequestExpect | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        from ..models.test_email_rule_request_expect import TestEmailRuleRequestExpect # noqa: PLC0415
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


        email_ids: list[str] | Unset = UNSET
        if not isinstance(self.email_ids, Unset):
            email_ids = []
            for email_ids_item_data in self.email_ids:
                email_ids_item = str(email_ids_item_data)
                email_ids.append(email_ids_item)



        classify_missing = self.classify_missing

        expect: dict[str, Any] | Unset = UNSET
        if not isinstance(self.expect, Unset):
            expect = self.expect.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
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
        if email_ids is not UNSET:
            field_dict["email_ids"] = email_ids
        if classify_missing is not UNSET:
            field_dict["classify_missing"] = classify_missing
        if expect is not UNSET:
            field_dict["expect"] = expect

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        from ..models.test_email_rule_request_expect import TestEmailRuleRequestExpect # noqa: PLC0415
        d = dict(src_dict)
        _tree = d.pop("tree", UNSET)
        tree: EmailRuleTreeInput | Unset
        if isinstance(_tree,  Unset):
            tree = UNSET
        else:
            tree = EmailRuleTreeInput.from_dict(_tree)




        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: TestEmailRuleRequestEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = TestEmailRuleRequestEvaluationScope(_evaluation_scope)




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
        kind: TestEmailRuleRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = TestEmailRuleRequestKind(_kind)




        _email_ids = d.pop("email_ids", UNSET)
        email_ids: list[UUID] | Unset = UNSET
        if _email_ids is not UNSET:
            email_ids = []
            for email_ids_item_data in _email_ids:
                email_ids_item = UUID(email_ids_item_data)



                email_ids.append(email_ids_item)


        classify_missing = d.pop("classify_missing", UNSET)

        _expect = d.pop("expect", UNSET)
        expect: TestEmailRuleRequestExpect | Unset
        if isinstance(_expect,  Unset):
            expect = UNSET
        else:
            expect = TestEmailRuleRequestExpect.from_dict(_expect)




        test_email_rule_request = cls(
            tree=tree,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            rule_id=rule_id,
            kind=kind,
            email_ids=email_ids,
            classify_missing=classify_missing,
            expect=expect,
        )

        return test_email_rule_request

