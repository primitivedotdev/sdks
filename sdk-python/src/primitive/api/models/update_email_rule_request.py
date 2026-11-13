from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_email_rule_request_evaluation_scope import UpdateEmailRuleRequestEvaluationScope
from ..models.update_email_rule_request_kind import UpdateEmailRuleRequestKind
from ..models.update_email_rule_request_state import UpdateEmailRuleRequestState
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_breadth import EmailRuleBreadth
  from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput
  from ..models.email_rule_scope_selection import EmailRuleScopeSelection
  from ..models.email_rule_scope_used import EmailRuleScopeUsed
  from ..models.email_rule_scope_warning import EmailRuleScopeWarning
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
            assumptions (list[str] | Unset): The compile response's assumptions. Stored as sent.
            warnings (list[str] | Unset): The compile response's warnings. Stored as sent, then any server note they lack on
                an address or domain the description names that the rule does not test, or on a grant rule that tests only who
                an email was sent to (on a rule request, every compiler note on the rule).
            compiled_by (str | Unset): Who produced the tree (not verified): the compile response's compiled_by, or member
                (the default) for a tree you wrote or edited.
            breadth (EmailRuleBreadth | None | Unset): Ignored (the compile answer's breadth).
            conditions_breadth (EmailRuleBreadth | None | Unset): Ignored.
            breadth_scope (EmailRuleScopeUsed | Unset):
            scope_warnings (list[EmailRuleScopeWarning] | Unset): Ignored (the compile answer's scope_warnings).
            kind (UpdateEmailRuleRequestKind | Unset): Must be the rule's own (400 kind_mismatch).
            evaluation_scope (UpdateEmailRuleRequestEvaluationScope | Unset): own_mailboxes: mail to your own addresses and
                agents (for a rule that shares, those mail:share_own lets you share). author: all you can read, inboxes added
                later included. selected: what scope_selection names. Left out, the scope stays. A change saves a new version
                with the same conditions, and is refused while the rule is shared.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
            if_version (int | Unset): The current_version you read: if it has moved, nothing is saved (409
                email_rule_conflict, version_moved). It guards versions only; if_revision guards every update.
            expectations (None | Unset | UpdateEmailRuleRequestExpectationsType0): Replaces its saved expectations (author
                only); null removes them.
            expectation_samples (list[EmailRuleExpectationSampleInput] | None | Unset): Replaces its saved made-up emails
                (author only); null or [] removes them.
            add_expectation_samples (list[EmailRuleExpectationSampleInput] | Unset): Adds made-up emails to those saved
                (author only), up to 20 in all.
            if_revision (int | Unset): The revision you read: if the rule was updated since, nothing is saved (409
                email_rule_conflict, revision_moved).
            if_expectations_pass (bool | Unset): true: judge the rule as this write leaves it (new tree, restored version,
                new scope, or the version it activates) against the expectations it leaves, as POST /email-rules/test would,
                before saving; it can take as long as a test. Failed: 409 expectations_failed; on emails the rule cannot read:
                409 expectations_unreadable; undecided: 409 expectations_undecided (each with details.expectations_check); none
                to judge: 400 no_expectations. Refused writes save nothing; a pass saves unless the rule moved meanwhile (409
                email_rule_conflict). Only writes that save a version or activate the rule are judged. Omitted: judged as with
                true when the write saves a version or changes the scope of an active rule that API keys, webhooks or a share
                read and that has expectations. false: never judged first.
            restore_version (int | Unset): Save version n again as the next version (author only): its english, tree,
                explanation, assumptions, warnings and compiled_by. A version carries no scope: the rule keeps its own unless
                evaluation_scope is sent. 404 version_not_found; 400 already_current or version_not_renderable. Not with a
                version's own fields.
     """

    name: str | Unset = UNSET
    state: UpdateEmailRuleRequestState | Unset = UNSET
    english: str | Unset = UNSET
    tree: EmailRuleTreeInput | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET
    breadth: EmailRuleBreadth | None | Unset = UNSET
    conditions_breadth: EmailRuleBreadth | None | Unset = UNSET
    breadth_scope: EmailRuleScopeUsed | Unset = UNSET
    scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
    kind: UpdateEmailRuleRequestKind | Unset = UNSET
    evaluation_scope: UpdateEmailRuleRequestEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET
    if_version: int | Unset = UNSET
    expectations: None | Unset | UpdateEmailRuleRequestExpectationsType0 = UNSET
    expectation_samples: list[EmailRuleExpectationSampleInput] | None | Unset = UNSET
    add_expectation_samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET
    if_revision: int | Unset = UNSET
    if_expectations_pass: bool | Unset = UNSET
    restore_version: int | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_scope_used import EmailRuleScopeUsed # noqa: PLC0415
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
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

        breadth: dict[str, Any] | None | Unset
        if isinstance(self.breadth, Unset):
            breadth = UNSET
        elif isinstance(self.breadth, EmailRuleBreadth):
            breadth = self.breadth.to_dict()
        else:
            breadth = self.breadth

        conditions_breadth: dict[str, Any] | None | Unset
        if isinstance(self.conditions_breadth, Unset):
            conditions_breadth = UNSET
        elif isinstance(self.conditions_breadth, EmailRuleBreadth):
            conditions_breadth = self.conditions_breadth.to_dict()
        else:
            conditions_breadth = self.conditions_breadth

        breadth_scope: dict[str, Any] | Unset = UNSET
        if not isinstance(self.breadth_scope, Unset):
            breadth_scope = self.breadth_scope.to_dict()

        scope_warnings: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.scope_warnings, Unset):
            scope_warnings = []
            for scope_warnings_item_data in self.scope_warnings:
                scope_warnings_item = scope_warnings_item_data.to_dict()
                scope_warnings.append(scope_warnings_item)



        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


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

        expectation_samples: list[dict[str, Any]] | None | Unset
        if isinstance(self.expectation_samples, Unset):
            expectation_samples = UNSET
        elif isinstance(self.expectation_samples, list):
            expectation_samples = []
            for expectation_samples_type_0_item_data in self.expectation_samples:
                expectation_samples_type_0_item = expectation_samples_type_0_item_data.to_dict()
                expectation_samples.append(expectation_samples_type_0_item)


        else:
            expectation_samples = self.expectation_samples

        add_expectation_samples: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.add_expectation_samples, Unset):
            add_expectation_samples = []
            for add_expectation_samples_item_data in self.add_expectation_samples:
                add_expectation_samples_item = add_expectation_samples_item_data.to_dict()
                add_expectation_samples.append(add_expectation_samples_item)



        if_revision = self.if_revision

        if_expectations_pass = self.if_expectations_pass

        restore_version = self.restore_version


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
        if breadth is not UNSET:
            field_dict["breadth"] = breadth
        if conditions_breadth is not UNSET:
            field_dict["conditions_breadth"] = conditions_breadth
        if breadth_scope is not UNSET:
            field_dict["breadth_scope"] = breadth_scope
        if scope_warnings is not UNSET:
            field_dict["scope_warnings"] = scope_warnings
        if kind is not UNSET:
            field_dict["kind"] = kind
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection
        if if_version is not UNSET:
            field_dict["if_version"] = if_version
        if expectations is not UNSET:
            field_dict["expectations"] = expectations
        if expectation_samples is not UNSET:
            field_dict["expectation_samples"] = expectation_samples
        if add_expectation_samples is not UNSET:
            field_dict["add_expectation_samples"] = add_expectation_samples
        if if_revision is not UNSET:
            field_dict["if_revision"] = if_revision
        if if_expectations_pass is not UNSET:
            field_dict["if_expectations_pass"] = if_expectations_pass
        if restore_version is not UNSET:
            field_dict["restore_version"] = restore_version

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_scope_used import EmailRuleScopeUsed # noqa: PLC0415
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
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

        def _parse_breadth(data: object) -> EmailRuleBreadth | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                breadth_type_1 = EmailRuleBreadth.from_dict(data)



                return breadth_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleBreadth | None | Unset, data)

        breadth = _parse_breadth(d.pop("breadth", UNSET))


        def _parse_conditions_breadth(data: object) -> EmailRuleBreadth | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                conditions_breadth_type_1 = EmailRuleBreadth.from_dict(data)



                return conditions_breadth_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleBreadth | None | Unset, data)

        conditions_breadth = _parse_conditions_breadth(d.pop("conditions_breadth", UNSET))


        _breadth_scope = d.pop("breadth_scope", UNSET)
        breadth_scope: EmailRuleScopeUsed | Unset
        if isinstance(_breadth_scope,  Unset):
            breadth_scope = UNSET
        else:
            breadth_scope = EmailRuleScopeUsed.from_dict(_breadth_scope)




        _scope_warnings = d.pop("scope_warnings", UNSET)
        scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
        if _scope_warnings is not UNSET:
            scope_warnings = []
            for scope_warnings_item_data in _scope_warnings:
                scope_warnings_item = EmailRuleScopeWarning.from_dict(scope_warnings_item_data)



                scope_warnings.append(scope_warnings_item)


        _kind = d.pop("kind", UNSET)
        kind: UpdateEmailRuleRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = UpdateEmailRuleRequestKind(_kind)




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


        def _parse_expectation_samples(data: object) -> list[EmailRuleExpectationSampleInput] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                expectation_samples_type_0 = []
                _expectation_samples_type_0 = data
                for expectation_samples_type_0_item_data in (_expectation_samples_type_0):
                    expectation_samples_type_0_item = EmailRuleExpectationSampleInput.from_dict(expectation_samples_type_0_item_data)



                    expectation_samples_type_0.append(expectation_samples_type_0_item)

                return expectation_samples_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[EmailRuleExpectationSampleInput] | None | Unset, data)

        expectation_samples = _parse_expectation_samples(d.pop("expectation_samples", UNSET))


        _add_expectation_samples = d.pop("add_expectation_samples", UNSET)
        add_expectation_samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET
        if _add_expectation_samples is not UNSET:
            add_expectation_samples = []
            for add_expectation_samples_item_data in _add_expectation_samples:
                add_expectation_samples_item = EmailRuleExpectationSampleInput.from_dict(add_expectation_samples_item_data)



                add_expectation_samples.append(add_expectation_samples_item)


        if_revision = d.pop("if_revision", UNSET)

        if_expectations_pass = d.pop("if_expectations_pass", UNSET)

        restore_version = d.pop("restore_version", UNSET)

        update_email_rule_request = cls(
            name=name,
            state=state,
            english=english,
            tree=tree,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
            breadth=breadth,
            conditions_breadth=conditions_breadth,
            breadth_scope=breadth_scope,
            scope_warnings=scope_warnings,
            kind=kind,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            if_version=if_version,
            expectations=expectations,
            expectation_samples=expectation_samples,
            add_expectation_samples=add_expectation_samples,
            if_revision=if_revision,
            if_expectations_pass=if_expectations_pass,
            restore_version=restore_version,
        )

        return update_email_rule_request

