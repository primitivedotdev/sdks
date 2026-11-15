from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_body_evaluation_scope import EmailRuleBodyEvaluationScope
from ..models.email_rule_body_kind import EmailRuleBodyKind
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_scope_selection import EmailRuleScopeSelection
  from ..models.email_rule_tree import EmailRuleTree





T = TypeVar("T", bound="EmailRuleBody")



@_attrs_define
class EmailRuleBody:
    """ 
        Attributes:
            english (str): The description it was compiled from.
            kind (EmailRuleBodyKind): grant or do_not_share.
            tree (EmailRuleTree):
            evaluation_scope (EmailRuleBodyEvaluationScope | Unset): Present only when given at compile.
            scope_selection (EmailRuleScopeSelection | Unset): For a selected rule: inboxes, and domains (each address at
                them the author reads); each one you can read.
     """

    english: str
    kind: EmailRuleBodyKind
    tree: EmailRuleTree
    evaluation_scope: EmailRuleBodyEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeSelection | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        english = self.english

        kind = self.kind.value

        tree = self.tree.to_dict()

        evaluation_scope: str | Unset = UNSET
        if not isinstance(self.evaluation_scope, Unset):
            evaluation_scope = self.evaluation_scope.value


        scope_selection: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scope_selection, Unset):
            scope_selection = self.scope_selection.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "english": english,
            "kind": kind,
            "tree": tree,
        })
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_selection import EmailRuleScopeSelection # noqa: PLC0415
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        d = dict(src_dict)
        english = d.pop("english")

        kind = EmailRuleBodyKind(d.pop("kind"))




        tree = EmailRuleTree.from_dict(d.pop("tree"))




        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: EmailRuleBodyEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = EmailRuleBodyEvaluationScope(_evaluation_scope)




        _scope_selection = d.pop("scope_selection", UNSET)
        scope_selection: EmailRuleScopeSelection | Unset
        if isinstance(_scope_selection,  Unset):
            scope_selection = UNSET
        else:
            scope_selection = EmailRuleScopeSelection.from_dict(_scope_selection)




        email_rule_body = cls(
            english=english,
            kind=kind,
            tree=tree,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
        )


        email_rule_body.additional_properties = d
        return email_rule_body

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
