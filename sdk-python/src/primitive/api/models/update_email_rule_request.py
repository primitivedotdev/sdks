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
  from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput
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
            kind (UpdateEmailRuleRequestKind | Unset): Must be the rule's own (400 kind_mismatch).
            evaluation_scope (UpdateEmailRuleRequestEvaluationScope | Unset): own_mailboxes: mail to your own addresses and
                agents (for a rule that shares, those mail:share_own lets you share). author: all you can read, inboxes added
                later included. selected: what scope_selection names. Left out, the scope stays. A change saves a new version
                with the same conditions, and is refused while the rule is shared.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
            expectations (None | Unset | UpdateEmailRuleRequestExpectationsType0): Replaces its saved expectations (author
                only); null removes them.
            expectation_samples (list[EmailRuleExpectationSampleInput] | None | Unset): Replaces its saved made-up emails
                (author only); null or [] removes them.
            add_expectation_samples (list[EmailRuleExpectationSampleInput] | Unset): Adds made-up emails to those saved
                (author only), up to 20 in all.
            if_revision (int | Unset): The revision you read: if the rule was updated since, nothing is saved (409
                email_rule_conflict, revision_moved).
            restore_version (int | Unset): Save version n again as the next version (author only): its english and tree. A
                version carries no scope: the rule keeps its own unless evaluation_scope is sent. 404 version_not_found; 400
                already_current or version_not_renderable. Not with a version's own fields.
     """

    name: str | Unset = UNSET
    state: UpdateEmailRuleRequestState | Unset = UNSET
    english: str | Unset = UNSET
    tree: EmailRuleTreeInput | Unset = UNSET
    kind: UpdateEmailRuleRequestKind | Unset = UNSET
    evaluation_scope: UpdateEmailRuleRequestEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET
    expectations: None | Unset | UpdateEmailRuleRequestExpectationsType0 = UNSET
    expectation_samples: list[EmailRuleExpectationSampleInput] | None | Unset = UNSET
    add_expectation_samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET
    if_revision: int | Unset = UNSET
    restore_version: int | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
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

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        evaluation_scope: str | Unset = UNSET
        if not isinstance(self.evaluation_scope, Unset):
            evaluation_scope = self.evaluation_scope.value


        scope_selection: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scope_selection, Unset):
            scope_selection = self.scope_selection.to_dict()

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
        if kind is not UNSET:
            field_dict["kind"] = kind
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection
        if expectations is not UNSET:
            field_dict["expectations"] = expectations
        if expectation_samples is not UNSET:
            field_dict["expectation_samples"] = expectation_samples
        if add_expectation_samples is not UNSET:
            field_dict["add_expectation_samples"] = add_expectation_samples
        if if_revision is not UNSET:
            field_dict["if_revision"] = if_revision
        if restore_version is not UNSET:
            field_dict["restore_version"] = restore_version

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
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

        restore_version = d.pop("restore_version", UNSET)

        update_email_rule_request = cls(
            name=name,
            state=state,
            english=english,
            tree=tree,
            kind=kind,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            expectations=expectations,
            expectation_samples=expectation_samples,
            add_expectation_samples=add_expectation_samples,
            if_revision=if_revision,
            restore_version=restore_version,
        )

        return update_email_rule_request

