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
  from ..models.create_email_rule_request_expectations import CreateEmailRuleRequestExpectations
  from ..models.email_rule_scope_selection import EmailRuleScopeSelection
  from ..models.email_rule_tree_input import EmailRuleTreeInput





T = TypeVar("T", bound="CreateEmailRuleRequest")



@_attrs_define
class CreateEmailRuleRequest:
    """ 
        Attributes:
            name (str): A short name for the rule.
            english (str): The plain-English description the rule was compiled from.
            tree (EmailRuleTreeInput):
            kind (CreateEmailRuleRequestKind | Unset): grant (the default): what the rule matches can be shared.
                do_not_share: the rule runs before every other rule, and while it is active no rule shares an email it matches;
                an email it cannot decide counts as matched. Set when the rule is created; it never changes.
            state (CreateEmailRuleRequestState | Unset): observe (the default) records what the rule would match and grants
                or blocks nothing; draft is not evaluated.
            evaluation_scope (CreateEmailRuleRequestEvaluationScope | Unset): own_mailboxes (the default): mail to your own
                addresses and agents (for a rule that shares, those mail:share_own lets you share). author: all you can read,
                inboxes added later included. selected: what scope_selection names.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
            expectations (CreateEmailRuleRequestExpectations | Unset): Emails it must match and must not (at most 100): a
                test by rule_id judges them unless expect is given, and each version it saves is checked against them.
            explanation (str | Unset): What the rule matches, in plain English. Left out, the server writes one from the
                tree.
            assumptions (list[str] | Unset): Readings chosen where the description was open to more than one, as the compile
                response returned them (including its lines naming any condition, question or confidence bar the description did
                not ask for). Stored as sent.
            warnings (list[str] | Unset): Parts of the description the rule does not express, as the compile response
                returned them (including its notes on what the automated and from_mailing_list columns read). Stored as sent.
            compiled_by (str | Unset): Who produced the tree (not verified): the compile response's compiled_by, or member
                (the default) for a tree you wrote or edited.
     """

    name: str
    english: str
    tree: EmailRuleTreeInput
    kind: CreateEmailRuleRequestKind | Unset = UNSET
    state: CreateEmailRuleRequestState | Unset = UNSET
    evaluation_scope: CreateEmailRuleRequestEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET
    expectations: CreateEmailRuleRequestExpectations | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_email_rule_request_expectations import CreateEmailRuleRequestExpectations # noqa: PLC0415
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        name = self.name

        english = self.english

        tree = self.tree.to_dict()

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

        expectations: dict[str, Any] | Unset = UNSET
        if not isinstance(self.expectations, Unset):
            expectations = self.expectations.to_dict()

        explanation = self.explanation

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
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if state is not UNSET:
            field_dict["state"] = state
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection
        if expectations is not UNSET:
            field_dict["expectations"] = expectations
        if explanation is not UNSET:
            field_dict["explanation"] = explanation
        if assumptions is not UNSET:
            field_dict["assumptions"] = assumptions
        if warnings is not UNSET:
            field_dict["warnings"] = warnings
        if compiled_by is not UNSET:
            field_dict["compiled_by"] = compiled_by

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_email_rule_request_expectations import CreateEmailRuleRequestExpectations # noqa: PLC0415
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name")

        english = d.pop("english")

        tree = EmailRuleTreeInput.from_dict(d.pop("tree"))




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
        scope_selection: EmailRuleScopeSelection | Unset
        if isinstance(_scope_selection,  Unset):
            scope_selection = UNSET
        else:
            scope_selection = EmailRuleScopeSelection.from_dict(_scope_selection)




        _expectations = d.pop("expectations", UNSET)
        expectations: CreateEmailRuleRequestExpectations | Unset
        if isinstance(_expectations,  Unset):
            expectations = UNSET
        else:
            expectations = CreateEmailRuleRequestExpectations.from_dict(_expectations)




        explanation = d.pop("explanation", UNSET)

        assumptions = cast(list[str], d.pop("assumptions", UNSET))


        warnings = cast(list[str], d.pop("warnings", UNSET))


        compiled_by = d.pop("compiled_by", UNSET)

        create_email_rule_request = cls(
            name=name,
            english=english,
            tree=tree,
            kind=kind,
            state=state,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            expectations=expectations,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
        )

        return create_email_rule_request

