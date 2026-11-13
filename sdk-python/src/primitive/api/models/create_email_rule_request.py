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
  from ..models.email_rule_breadth import EmailRuleBreadth
  from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput
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
                or blocks nothing; draft is not evaluated; active only for a do_not_share rule.
            evaluation_scope (CreateEmailRuleRequestEvaluationScope | Unset): own_mailboxes (the default): mail to your own
                addresses and agents (for a rule that shares, those mail:share_own lets you share). author: all you can read,
                inboxes added later included. selected: what scope_selection names.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
            expectations (CreateEmailRuleRequestExpectations | Unset): Emails it must match and must not (at most 100): a
                test by rule_id judges them unless expect is given, and each version it saves is checked against them.
            expectation_samples (list[EmailRuleExpectationSampleInput] | Unset): Made-up emails it must match or not (at
                most 20).
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
     """

    name: str
    english: str
    tree: EmailRuleTreeInput
    kind: CreateEmailRuleRequestKind | Unset = UNSET
    state: CreateEmailRuleRequestState | Unset = UNSET
    evaluation_scope: CreateEmailRuleRequestEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET
    expectations: CreateEmailRuleRequestExpectations | Unset = UNSET
    expectation_samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET
    breadth: EmailRuleBreadth | None | Unset = UNSET
    conditions_breadth: EmailRuleBreadth | None | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_email_rule_request_expectations import CreateEmailRuleRequestExpectations # noqa: PLC0415
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
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

        expectation_samples: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.expectation_samples, Unset):
            expectation_samples = []
            for expectation_samples_item_data in self.expectation_samples:
                expectation_samples_item = expectation_samples_item_data.to_dict()
                expectation_samples.append(expectation_samples_item)



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
        if expectation_samples is not UNSET:
            field_dict["expectation_samples"] = expectation_samples
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

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_email_rule_request_expectations import CreateEmailRuleRequestExpectations # noqa: PLC0415
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
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




        _expectation_samples = d.pop("expectation_samples", UNSET)
        expectation_samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET
        if _expectation_samples is not UNSET:
            expectation_samples = []
            for expectation_samples_item_data in _expectation_samples:
                expectation_samples_item = EmailRuleExpectationSampleInput.from_dict(expectation_samples_item_data)



                expectation_samples.append(expectation_samples_item)


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


        create_email_rule_request = cls(
            name=name,
            english=english,
            tree=tree,
            kind=kind,
            state=state,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            expectations=expectations,
            expectation_samples=expectation_samples,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
            breadth=breadth,
            conditions_breadth=conditions_breadth,
        )

        return create_email_rule_request

