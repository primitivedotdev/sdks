from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_email_rule_request_evaluation_scope import UpdateEmailRuleRequestEvaluationScope
from ..models.update_email_rule_request_state import UpdateEmailRuleRequestState
from typing import cast

if TYPE_CHECKING:
  from ..models.update_email_rule_request_scope_selection import UpdateEmailRuleRequestScopeSelection
  from ..models.update_email_rule_request_tree import UpdateEmailRuleRequestTree





T = TypeVar("T", bound="UpdateEmailRuleRequest")



@_attrs_define
class UpdateEmailRuleRequest:
    """ 
        Attributes:
            name (str | Unset): A short name for the rule.
            state (UpdateEmailRuleRequestState | Unset): draft disables the rule; observe records decisions; active also
                grants what it matches. Keys read and receive what a rule granted only while it is active: leaving active pauses
                that, and returning to active restores reads and the delivery of queued mail not yet skipped.
            english (str | Unset): The plain-English description the rule was compiled from.
            tree (UpdateEmailRuleRequestTree | Unset): The rule tree. Checked against the column contract on save.
            explanation (str | Unset): What the rule matches, in plain English.
            assumptions (list[str] | Unset): Readings chosen where the description was open to more than one.
            warnings (list[str] | Unset): Parts of the description the rule does not express.
            compiled_by (str | Unset): Who produced the tree, as the caller states it (not verified): the compile response's
                compiled_by, or member when you wrote or edited it yourself. Defaults to member.
            evaluation_scope (UpdateEmailRuleRequestEvaluationScope | Unset): author: all mail its author can read.
                own_mailboxes: mail to their own addresses. selected: what scope_selection names. Never more than the author can
                read.
            scope_selection (UpdateEmailRuleRequestScopeSelection | Unset): Inboxes, and domains (every address at them the
                author can read), for a selected rule; each one you can read.
     """

    name: str | Unset = UNSET
    state: UpdateEmailRuleRequestState | Unset = UNSET
    english: str | Unset = UNSET
    tree: UpdateEmailRuleRequestTree | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET
    evaluation_scope: UpdateEmailRuleRequestEvaluationScope | Unset = UNSET
    scope_selection: UpdateEmailRuleRequestScopeSelection | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_email_rule_request_scope_selection import UpdateEmailRuleRequestScopeSelection # noqa: PLC0415
        from ..models.update_email_rule_request_tree import UpdateEmailRuleRequestTree # noqa: PLC0415
        name = self.name

        state: str | Unset = UNSET
        if not isinstance(self.state, Unset):
            state = self.state.value


        english = self.english

        tree: dict[str, Any] | Unset = UNSET
        if not isinstance(self.tree, Unset):
            tree = self.tree.to_dict()

        explanation = self.explanation

        assumptions: list[str] | Unset = UNSET
        if not isinstance(self.assumptions, Unset):
            assumptions = self.assumptions



        warnings: list[str] | Unset = UNSET
        if not isinstance(self.warnings, Unset):
            warnings = self.warnings



        compiled_by = self.compiled_by

        evaluation_scope: str | Unset = UNSET
        if not isinstance(self.evaluation_scope, Unset):
            evaluation_scope = self.evaluation_scope.value


        scope_selection: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scope_selection, Unset):
            scope_selection = self.scope_selection.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if state is not UNSET:
            field_dict["state"] = state
        if english is not UNSET:
            field_dict["english"] = english
        if tree is not UNSET:
            field_dict["tree"] = tree
        if explanation is not UNSET:
            field_dict["explanation"] = explanation
        if assumptions is not UNSET:
            field_dict["assumptions"] = assumptions
        if warnings is not UNSET:
            field_dict["warnings"] = warnings
        if compiled_by is not UNSET:
            field_dict["compiled_by"] = compiled_by
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_email_rule_request_scope_selection import UpdateEmailRuleRequestScopeSelection # noqa: PLC0415
        from ..models.update_email_rule_request_tree import UpdateEmailRuleRequestTree # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        _state = d.pop("state", UNSET)
        state: UpdateEmailRuleRequestState | Unset
        if isinstance(_state,  Unset):
            state = UNSET
        else:
            state = UpdateEmailRuleRequestState(_state)




        english = d.pop("english", UNSET)

        _tree = d.pop("tree", UNSET)
        tree: UpdateEmailRuleRequestTree | Unset
        if isinstance(_tree,  Unset):
            tree = UNSET
        else:
            tree = UpdateEmailRuleRequestTree.from_dict(_tree)




        explanation = d.pop("explanation", UNSET)

        assumptions = cast(list[str], d.pop("assumptions", UNSET))


        warnings = cast(list[str], d.pop("warnings", UNSET))


        compiled_by = d.pop("compiled_by", UNSET)

        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: UpdateEmailRuleRequestEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = UpdateEmailRuleRequestEvaluationScope(_evaluation_scope)




        _scope_selection = d.pop("scope_selection", UNSET)
        scope_selection: UpdateEmailRuleRequestScopeSelection | Unset
        if isinstance(_scope_selection,  Unset):
            scope_selection = UNSET
        else:
            scope_selection = UpdateEmailRuleRequestScopeSelection.from_dict(_scope_selection)




        update_email_rule_request = cls(
            name=name,
            state=state,
            english=english,
            tree=tree,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
        )

        return update_email_rule_request

