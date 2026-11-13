from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_scope_used_evaluation_scope import EmailRuleScopeUsedEvaluationScope
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_scope_used_scope_selection_type_0 import EmailRuleScopeUsedScopeSelectionType0





T = TypeVar("T", bound="EmailRuleScopeUsed")



@_attrs_define
class EmailRuleScopeUsed:
    """ 
        Attributes:
            evaluation_scope (EmailRuleScopeUsedEvaluationScope): author, own_mailboxes or selected, as a rule's
                evaluation_scope.
            scope_selection (EmailRuleScopeUsedScopeSelectionType0 | None): What a selected scope names; null for any other.
     """

    evaluation_scope: EmailRuleScopeUsedEvaluationScope
    scope_selection: EmailRuleScopeUsedScopeSelectionType0 | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_used_scope_selection_type_0 import EmailRuleScopeUsedScopeSelectionType0 # noqa: PLC0415
        evaluation_scope = self.evaluation_scope.value

        scope_selection: dict[str, Any] | None
        if isinstance(self.scope_selection, EmailRuleScopeUsedScopeSelectionType0):
            scope_selection = self.scope_selection.to_dict()
        else:
            scope_selection = self.scope_selection


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "evaluation_scope": evaluation_scope,
            "scope_selection": scope_selection,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_used_scope_selection_type_0 import EmailRuleScopeUsedScopeSelectionType0 # noqa: PLC0415
        d = dict(src_dict)
        evaluation_scope = EmailRuleScopeUsedEvaluationScope(d.pop("evaluation_scope"))




        def _parse_scope_selection(data: object) -> EmailRuleScopeUsedScopeSelectionType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                scope_selection_type_0 = EmailRuleScopeUsedScopeSelectionType0.from_dict(data)



                return scope_selection_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleScopeUsedScopeSelectionType0 | None, data)

        scope_selection = _parse_scope_selection(d.pop("scope_selection"))


        email_rule_scope_used = cls(
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
        )


        email_rule_scope_used.additional_properties = d
        return email_rule_scope_used

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
