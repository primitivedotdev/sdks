from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_email_rule_input_state import CreateEmailRuleInputState
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_tree import EmailRuleTree





T = TypeVar("T", bound="CreateEmailRuleInput")



@_attrs_define
class CreateEmailRuleInput:
    """ 
        Attributes:
            name (str): Rule name.
            english (str): The plain-English description the rule was compiled from.
            tree (EmailRuleTree): A compiled rule. The server checks it against the column contract on save.
            explanation (str): What the rule matches.
            state (CreateEmailRuleInputState | Unset): `observe` (default) records matches and grants nothing; `draft` is
                not evaluated.
            assumptions (list[str] | Unset): Readings chosen where the description was ambiguous.
            warnings (list[str] | Unset): What the rule does not express.
            compiled_by (str | Unset): The compile response's `compiled_by`, or `member` (default) for a tree you wrote.
     """

    name: str
    english: str
    tree: EmailRuleTree
    explanation: str
    state: CreateEmailRuleInputState | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        name = self.name

        english = self.english

        tree = self.tree.to_dict()

        explanation = self.explanation

        state: str | Unset = UNSET
        if not isinstance(self.state, Unset):
            state = self.state.value


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
            "name": name,
            "english": english,
            "tree": tree,
            "explanation": explanation,
        })
        if state is not UNSET:
            field_dict["state"] = state
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
        name = d.pop("name")

        english = d.pop("english")

        tree = EmailRuleTree.from_dict(d.pop("tree"))




        explanation = d.pop("explanation")

        _state = d.pop("state", UNSET)
        state: CreateEmailRuleInputState | Unset
        if isinstance(_state,  Unset):
            state = UNSET
        else:
            state = CreateEmailRuleInputState(_state)




        assumptions = cast(list[str], d.pop("assumptions", UNSET))


        warnings = cast(list[str], d.pop("warnings", UNSET))


        compiled_by = d.pop("compiled_by", UNSET)

        create_email_rule_input = cls(
            name=name,
            english=english,
            tree=tree,
            explanation=explanation,
            state=state,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
        )


        create_email_rule_input.additional_properties = d
        return create_email_rule_input

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
