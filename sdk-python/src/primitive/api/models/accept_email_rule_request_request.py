from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.accept_email_rule_request_request_kind import AcceptEmailRuleRequestRequestKind
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_breadth import EmailRuleBreadth
  from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput
  from ..models.email_rule_scope_used import EmailRuleScopeUsed
  from ..models.email_rule_tree_input import EmailRuleTreeInput





T = TypeVar("T", bound="AcceptEmailRuleRequestRequest")



@_attrs_define
class AcceptEmailRuleRequestRequest:
    """ 
        Attributes:
            name (str | Unset): A name for the rule. Defaults to the name it was asked for under.
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
            kind (AcceptEmailRuleRequestRequestKind | Unset): Only grant.
            expectation_samples (list[EmailRuleExpectationSampleInput] | Unset): Made-up emails the rule must match or not,
                such as look-alikes it must never match, kept on the rule this accept writes.
     """

    name: str | Unset = UNSET
    english: str | Unset = UNSET
    tree: EmailRuleTreeInput | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET
    breadth: EmailRuleBreadth | None | Unset = UNSET
    conditions_breadth: EmailRuleBreadth | None | Unset = UNSET
    breadth_scope: EmailRuleScopeUsed | Unset = UNSET
    kind: AcceptEmailRuleRequestRequestKind | Unset = UNSET
    expectation_samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
        from ..models.email_rule_scope_used import EmailRuleScopeUsed # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        name = self.name

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

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        expectation_samples: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.expectation_samples, Unset):
            expectation_samples = []
            for expectation_samples_item_data in self.expectation_samples:
                expectation_samples_item = expectation_samples_item_data.to_dict()
                expectation_samples.append(expectation_samples_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
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
        if kind is not UNSET:
            field_dict["kind"] = kind
        if expectation_samples is not UNSET:
            field_dict["expectation_samples"] = expectation_samples

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
        from ..models.email_rule_scope_used import EmailRuleScopeUsed # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

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




        _kind = d.pop("kind", UNSET)
        kind: AcceptEmailRuleRequestRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = AcceptEmailRuleRequestRequestKind(_kind)




        _expectation_samples = d.pop("expectation_samples", UNSET)
        expectation_samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET
        if _expectation_samples is not UNSET:
            expectation_samples = []
            for expectation_samples_item_data in _expectation_samples:
                expectation_samples_item = EmailRuleExpectationSampleInput.from_dict(expectation_samples_item_data)



                expectation_samples.append(expectation_samples_item)


        accept_email_rule_request_request = cls(
            name=name,
            english=english,
            tree=tree,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
            breadth=breadth,
            conditions_breadth=conditions_breadth,
            breadth_scope=breadth_scope,
            kind=kind,
            expectation_samples=expectation_samples,
        )

        return accept_email_rule_request_request

