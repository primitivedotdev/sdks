from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_email_rule_request_evaluation_scope import CreateEmailRuleRequestEvaluationScope
from ..models.create_email_rule_request_kind import CreateEmailRuleRequestKind
from ..models.create_email_rule_request_state import CreateEmailRuleRequestState
from typing import cast

if TYPE_CHECKING:
  from ..models.create_email_rule_request_scope_selection import CreateEmailRuleRequestScopeSelection
  from ..models.create_email_rule_request_tree import CreateEmailRuleRequestTree





T = TypeVar("T", bound="CreateEmailRuleRequest")



@_attrs_define
class CreateEmailRuleRequest:
    """ 
        Attributes:
            name (str): A short name for the rule.
            english (str): The plain-English description the rule was compiled from.
            tree (CreateEmailRuleRequestTree): The rule tree. Checked against the column contract on save.
            explanation (str): What the rule matches, in plain English.
            kind (CreateEmailRuleRequestKind | Unset): grant (the default): what the rule matches can be shared.
                do_not_share: the rule runs before every other rule, and while it is active no rule shares an email it matches;
                an email it cannot decide counts as matched. Set when the rule is created; it never changes.
            state (CreateEmailRuleRequestState | Unset): observe (the default) records what the rule would match and grants
                or blocks nothing; draft is not evaluated.
            evaluation_scope (CreateEmailRuleRequestEvaluationScope | Unset): own_mailboxes (the default): mail to your own
                addresses and agents (for a rule that shares, those you can send from). author: all mail you can read, including
                inboxes added later. selected: what scope_selection names.
            scope_selection (CreateEmailRuleRequestScopeSelection | Unset): Inboxes, and domains (every address at them the
                author can read), for a selected rule; each one you can read.
            assumptions (list[str] | Unset): Readings chosen where the description was open to more than one.
            warnings (list[str] | Unset): Parts of the description the rule does not express.
            compiled_by (str | Unset): Who produced the tree, as the caller states it (not verified): the compile response's
                compiled_by, or member when you wrote or edited it yourself. Defaults to member.
     """

    name: str
    english: str
    tree: CreateEmailRuleRequestTree
    explanation: str
    kind: CreateEmailRuleRequestKind | Unset = UNSET
    state: CreateEmailRuleRequestState | Unset = UNSET
    evaluation_scope: CreateEmailRuleRequestEvaluationScope | Unset = UNSET
    scope_selection: CreateEmailRuleRequestScopeSelection | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_email_rule_request_scope_selection import CreateEmailRuleRequestScopeSelection # noqa: PLC0415
        from ..models.create_email_rule_request_tree import CreateEmailRuleRequestTree # noqa: PLC0415
        name = self.name

        english = self.english

        tree = self.tree.to_dict()

        explanation = self.explanation

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        state: str | Unset = UNSET
        if not isinstance(self.state, Unset):
            state = self.state.value


        evaluation_scope: str | Unset = UNSET
        if not isinstance(self.evaluation_scope, Unset):
            evaluation_scope = self.evaluation_scope.value


        scope_selection: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scope_selection, Unset):
            scope_selection = self.scope_selection.to_dict()

        assumptions: list[str] | Unset = UNSET
        if not isinstance(self.assumptions, Unset):
            assumptions = self.assumptions



        warnings: list[str] | Unset = UNSET
        if not isinstance(self.warnings, Unset):
            warnings = self.warnings



        compiled_by = self.compiled_by


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
            "english": english,
            "tree": tree,
            "explanation": explanation,
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if state is not UNSET:
            field_dict["state"] = state
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection
        if assumptions is not UNSET:
            field_dict["assumptions"] = assumptions
        if warnings is not UNSET:
            field_dict["warnings"] = warnings
        if compiled_by is not UNSET:
            field_dict["compiled_by"] = compiled_by

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_email_rule_request_scope_selection import CreateEmailRuleRequestScopeSelection # noqa: PLC0415
        from ..models.create_email_rule_request_tree import CreateEmailRuleRequestTree # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name")

        english = d.pop("english")

        tree = CreateEmailRuleRequestTree.from_dict(d.pop("tree"))




        explanation = d.pop("explanation")

        _kind = d.pop("kind", UNSET)
        kind: CreateEmailRuleRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = CreateEmailRuleRequestKind(_kind)




        _state = d.pop("state", UNSET)
        state: CreateEmailRuleRequestState | Unset
        if isinstance(_state,  Unset):
            state = UNSET
        else:
            state = CreateEmailRuleRequestState(_state)




        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: CreateEmailRuleRequestEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = CreateEmailRuleRequestEvaluationScope(_evaluation_scope)




        _scope_selection = d.pop("scope_selection", UNSET)
        scope_selection: CreateEmailRuleRequestScopeSelection | Unset
        if isinstance(_scope_selection,  Unset):
            scope_selection = UNSET
        else:
            scope_selection = CreateEmailRuleRequestScopeSelection.from_dict(_scope_selection)




        assumptions = cast(list[str], d.pop("assumptions", UNSET))


        warnings = cast(list[str], d.pop("warnings", UNSET))


        compiled_by = d.pop("compiled_by", UNSET)

        create_email_rule_request = cls(
            name=name,
            english=english,
            tree=tree,
            explanation=explanation,
            kind=kind,
            state=state,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
        )

        return create_email_rule_request

