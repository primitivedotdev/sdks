from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.generate_look_alikes_request_evaluation_scope import GenerateLookAlikesRequestEvaluationScope
from ..models.generate_look_alikes_request_kind import GenerateLookAlikesRequestKind
from ..models.generate_look_alikes_request_kinds_item import GenerateLookAlikesRequestKindsItem
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_scope_selection import EmailRuleScopeSelection
  from ..models.email_rule_tree_input import EmailRuleTreeInput





T = TypeVar("T", bound="GenerateLookAlikesRequest")



@_attrs_define
class GenerateLookAlikesRequest:
    """ 
        Attributes:
            tree (EmailRuleTreeInput | Unset):
            english (str | Unset): What the tree is meant to match; without it, the tree is described in words.
            evaluation_scope (GenerateLookAlikesRequestEvaluationScope | Unset): own_mailboxes (the default): mail to your
                own addresses and agents (for a rule that shares, those mail:share_own lets you share). author: all you can
                read, inboxes added later included. selected: what scope_selection names.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
            rule_id (UUID | Unset): A saved rule you can see: its current version and words.
            request_id (UUID | Unset): A rule request you can see: its rule as asked.
            kind (GenerateLookAlikesRequestKind | Unset): For an unsaved tree: do_not_share tests it as a rule that blocks
                sharing, so an email it cannot decide counts as matched. A saved rule uses its own.
            count (int | Unset): How many, 1 to 8; 6 by default.
            kinds (list[GenerateLookAlikesRequestKindsItem] | Unset): Which kinds, taken in turn; all by default, the
                private ones first.
            to (str | Unset): The mailbox they arrive in; by default the rule author's (a request's target's) sign-in
                address when you may see it, else yours.
     """

    tree: EmailRuleTreeInput | Unset = UNSET
    english: str | Unset = UNSET
    evaluation_scope: GenerateLookAlikesRequestEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET
    rule_id: UUID | Unset = UNSET
    request_id: UUID | Unset = UNSET
    kind: GenerateLookAlikesRequestKind | Unset = UNSET
    count: int | Unset = UNSET
    kinds: list[GenerateLookAlikesRequestKindsItem] | Unset = UNSET
    to: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        tree: dict[str, Any] | Unset = UNSET
        if not isinstance(self.tree, Unset):
            tree = self.tree.to_dict()

        english = self.english

        evaluation_scope: str | Unset = UNSET
        if not isinstance(self.evaluation_scope, Unset):
            evaluation_scope = self.evaluation_scope.value


        scope_selection: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scope_selection, Unset):
            scope_selection = self.scope_selection.to_dict()

        rule_id: str | Unset = UNSET
        if not isinstance(self.rule_id, Unset):
            rule_id = str(self.rule_id)

        request_id: str | Unset = UNSET
        if not isinstance(self.request_id, Unset):
            request_id = str(self.request_id)

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        count = self.count

        kinds: list[str] | Unset = UNSET
        if not isinstance(self.kinds, Unset):
            kinds = []
            for kinds_item_data in self.kinds:
                kinds_item = kinds_item_data.value
                kinds.append(kinds_item)



        to = self.to


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if tree is not UNSET:
            field_dict["tree"] = tree
        if english is not UNSET:
            field_dict["english"] = english
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection
        if rule_id is not UNSET:
            field_dict["rule_id"] = rule_id
        if request_id is not UNSET:
            field_dict["request_id"] = request_id
        if kind is not UNSET:
            field_dict["kind"] = kind
        if count is not UNSET:
            field_dict["count"] = count
        if kinds is not UNSET:
            field_dict["kinds"] = kinds
        if to is not UNSET:
            field_dict["to"] = to

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        d = dict(src_dict)
        _tree = d.pop("tree", UNSET)
        tree: EmailRuleTreeInput | Unset
        if isinstance(_tree,  Unset):
            tree = UNSET
        else:
            tree = EmailRuleTreeInput.from_dict(_tree)




        english = d.pop("english", UNSET)

        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: GenerateLookAlikesRequestEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = GenerateLookAlikesRequestEvaluationScope(_evaluation_scope)




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




        _request_id = d.pop("request_id", UNSET)
        request_id: UUID | Unset
        if isinstance(_request_id,  Unset):
            request_id = UNSET
        else:
            request_id = UUID(_request_id)




        _kind = d.pop("kind", UNSET)
        kind: GenerateLookAlikesRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = GenerateLookAlikesRequestKind(_kind)




        count = d.pop("count", UNSET)

        _kinds = d.pop("kinds", UNSET)
        kinds: list[GenerateLookAlikesRequestKindsItem] | Unset = UNSET
        if _kinds is not UNSET:
            kinds = []
            for kinds_item_data in _kinds:
                kinds_item = GenerateLookAlikesRequestKindsItem(kinds_item_data)



                kinds.append(kinds_item)


        to = d.pop("to", UNSET)

        generate_look_alikes_request = cls(
            tree=tree,
            english=english,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            rule_id=rule_id,
            request_id=request_id,
            kind=kind,
            count=count,
            kinds=kinds,
            to=to,
        )

        return generate_look_alikes_request

