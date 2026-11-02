from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_email_rule_input_state import UpdateEmailRuleInputState
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_tree import EmailRuleTree





T = TypeVar("T", bound="UpdateEmailRuleInput")



@_attrs_define
class UpdateEmailRuleInput:
    """ Send at least one field. A new version needs `english`, `tree` and `explanation`; `assumptions`, `warnings` and
    `compiled_by` come only with them.

        Attributes:
            name (str | Unset): Rule name.
            state (UpdateEmailRuleInputState | Unset): `draft` disables the rule, `observe` records decisions, `active` also
                grants matches.
            english (str | Unset): The plain-English description the new version was compiled from.
            tree (EmailRuleTree | Unset): A compiled rule. The server checks it against the column contract on save.
            explanation (str | Unset): What the new version matches.
            assumptions (list[str] | Unset): Readings chosen where the description was ambiguous.
            warnings (list[str] | Unset): What the rule does not express.
            compiled_by (str | Unset): The compile response's `compiled_by`, or `member` (default) for a tree you wrote.
     """

    name: str | Unset = UNSET
    state: UpdateEmailRuleInputState | Unset = UNSET
    english: str | Unset = UNSET
    tree: EmailRuleTree | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
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


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        _state = d.pop("state", UNSET)
        state: UpdateEmailRuleInputState | Unset
        if isinstance(_state,  Unset):
            state = UNSET
        else:
            state = UpdateEmailRuleInputState(_state)




        english = d.pop("english", UNSET)

        _tree = d.pop("tree", UNSET)
        tree: EmailRuleTree | Unset
        if isinstance(_tree,  Unset):
            tree = UNSET
        else:
            tree = EmailRuleTree.from_dict(_tree)




        explanation = d.pop("explanation", UNSET)

        assumptions = cast(list[str], d.pop("assumptions", UNSET))


        warnings = cast(list[str], d.pop("warnings", UNSET))


        compiled_by = d.pop("compiled_by", UNSET)

        update_email_rule_input = cls(
            name=name,
            state=state,
            english=english,
            tree=tree,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
        )


        update_email_rule_input.additional_properties = d
        return update_email_rule_input

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
