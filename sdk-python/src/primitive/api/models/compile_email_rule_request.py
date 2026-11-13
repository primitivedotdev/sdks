from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.compile_email_rule_request_evaluation_scope import CompileEmailRuleRequestEvaluationScope
from ..models.compile_email_rule_request_kind import CompileEmailRuleRequestKind
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_scope_selection import EmailRuleScopeSelection





T = TypeVar("T", bound="CompileEmailRuleRequest")



@_attrs_define
class CompileEmailRuleRequest:
    """ 
        Attributes:
            english (str): What the rule should match, in plain English.
            kind (CompileEmailRuleRequestKind | Unset): What the rule will be: grant (the default) or do_not_share. A do-
                not-share rule is compiled for recall: conditions only as narrow as the description says, and the judgement of
                what it describes put into questions, since an email it misses can be shared.
            include_sql (bool | Unset): Also return the SQL the rule renders to. Off by default.
            evaluation_scope (CompileEmailRuleRequestEvaluationScope | Unset): The scope breadth is counted over, as a test
                of the tree runs it: send the one you will save the rule with. Nothing is saved. own_mailboxes (the default):
                mail to your own addresses and agents (for a rule that shares, those mail:share_own lets you share). author: all
                you can read, inboxes added later included. selected: what scope_selection names.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
     """

    english: str
    kind: CompileEmailRuleRequestKind | Unset = UNSET
    include_sql: bool | Unset = UNSET
    evaluation_scope: CompileEmailRuleRequestEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        english = self.english

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        include_sql = self.include_sql

        evaluation_scope: str | Unset = UNSET
        if not isinstance(self.evaluation_scope, Unset):
            evaluation_scope = self.evaluation_scope.value


        scope_selection: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scope_selection, Unset):
            scope_selection = self.scope_selection.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "english": english,
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if include_sql is not UNSET:
            field_dict["include_sql"] = include_sql
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        d = dict(src_dict)
        english = d.pop("english")

        _kind = d.pop("kind", UNSET)
        kind: CompileEmailRuleRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = CompileEmailRuleRequestKind(_kind)




        include_sql = d.pop("include_sql", UNSET)

        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: CompileEmailRuleRequestEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = CompileEmailRuleRequestEvaluationScope(_evaluation_scope)




        _scope_selection = d.pop("scope_selection", UNSET)
        scope_selection: EmailRuleScopeSelection | Unset
        if isinstance(_scope_selection,  Unset):
            scope_selection = UNSET
        else:
            scope_selection = EmailRuleScopeSelection.from_dict(_scope_selection)




        compile_email_rule_request = cls(
            english=english,
            kind=kind,
            include_sql=include_sql,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
        )

        return compile_email_rule_request

