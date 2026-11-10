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
  from ..models.email_rule_scope_selection import EmailRuleScopeSelection
  from ..models.email_rule_tree_input import EmailRuleTreeInput
  from ..models.update_email_rule_request_expectations_type_0 import UpdateEmailRuleRequestExpectationsType0





T = TypeVar("T", bound="UpdateEmailRuleRequest")



@_attrs_define
class UpdateEmailRuleRequest:
    """ 
        Attributes:
            name (str | Unset): A short name for the rule.
            state (UpdateEmailRuleRequestState | Unset): draft disables the rule; observe records decisions; active also
                grants what it matches, or for a do_not_share rule keeps it from being shared. Keys read and receive what a rule
                granted only while it is active: leaving active pauses that, and returning to active restores reads and the
                delivery of queued mail not yet skipped.
            english (str | Unset): The plain-English description the rule was compiled from.
            tree (EmailRuleTreeInput | Unset):
            explanation (str | Unset): What the rule matches, in plain English. Left out, the server writes one from the
                tree.
            assumptions (list[str] | Unset): Readings chosen where the description was open to more than one, as the compile
                response returned them (including its lines naming any condition, question or confidence bar the description did
                not ask for). Stored as sent.
            warnings (list[str] | Unset): Parts of the description the rule does not express, as the compile response
                returned them (including its notes on what the automated and from_mailing_list columns read). Stored as sent.
            compiled_by (str | Unset): Who produced the tree (not verified): the compile response's compiled_by, or member
                (the default) for a tree you wrote or edited.
            evaluation_scope (UpdateEmailRuleRequestEvaluationScope | Unset): own_mailboxes: mail to your own addresses and
                agents (for a rule that shares, those mail:share_own lets you share). author: all you can read, inboxes added
                later included. selected: what scope_selection names. Left out, the scope stays. A change saves a new version
                with the same conditions, and is refused while the rule is shared.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
            if_version (int | Unset): The current_version you read. If the rule's now differs, nothing changes: 409
                email_rule_conflict, details.reason version_moved and details.current_version. Send it with a new version so a
                concurrent edit is never replaced unseen. It guards versions only: a change to expectations alone saves none.
            expectations (None | Unset | UpdateEmailRuleRequestExpectationsType0): Replaces its saved expectations (author
                only); null removes them.
     """

    name: str | Unset = UNSET
    state: UpdateEmailRuleRequestState | Unset = UNSET
    english: str | Unset = UNSET
    tree: EmailRuleTreeInput | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET
    evaluation_scope: UpdateEmailRuleRequestEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET
    if_version: int | Unset = UNSET
    expectations: None | Unset | UpdateEmailRuleRequestExpectationsType0 = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        from ..models.update_email_rule_request_expectations_type_0 import UpdateEmailRuleRequestExpectationsType0 # noqa: PLC0415
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

        if_version = self.if_version

        expectations: dict[str, Any] | None | Unset
        if isinstance(self.expectations, Unset):
            expectations = UNSET
        elif isinstance(self.expectations, UpdateEmailRuleRequestExpectationsType0):
            expectations = self.expectations.to_dict()
        else:
            expectations = self.expectations


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
        if if_version is not UNSET:
            field_dict["if_version"] = if_version
        if expectations is not UNSET:
            field_dict["expectations"] = expectations

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        from ..models.update_email_rule_request_expectations_type_0 import UpdateEmailRuleRequestExpectationsType0 # noqa: PLC0415
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
        tree: EmailRuleTreeInput | Unset
        if isinstance(_tree,  Unset):
            tree = UNSET
        else:
            tree = EmailRuleTreeInput.from_dict(_tree)




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
        scope_selection: EmailRuleScopeSelection | Unset
        if isinstance(_scope_selection,  Unset):
            scope_selection = UNSET
        else:
            scope_selection = EmailRuleScopeSelection.from_dict(_scope_selection)




        if_version = d.pop("if_version", UNSET)

        def _parse_expectations(data: object) -> None | Unset | UpdateEmailRuleRequestExpectationsType0:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                expectations_type_0 = UpdateEmailRuleRequestExpectationsType0.from_dict(data)



                return expectations_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UpdateEmailRuleRequestExpectationsType0, data)

        expectations = _parse_expectations(d.pop("expectations", UNSET))


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
            if_version=if_version,
            expectations=expectations,
        )

        return update_email_rule_request

