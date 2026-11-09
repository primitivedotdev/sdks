from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_email_rule_request_state import CreateEmailRuleRequestState
from typing import cast

if TYPE_CHECKING:
  from ..models.create_email_rule_request_tree import CreateEmailRuleRequestTree





T = TypeVar("T", bound="CreateEmailRuleRequest")



@_attrs_define
class CreateEmailRuleRequest:
    """ 
        Attributes:
            name (str): A short name for the rule.
            english (str): The plain-English description the rule was compiled from.
            tree (CreateEmailRuleRequestTree): The rule tree. Checked against the column contract on save.
            explanation (str): What the rule matches, in plain English.
            state (CreateEmailRuleRequestState | Unset): observe (the default) records what the rule would match and grants
                nothing; draft is not evaluated.
            assumptions (list[str] | Unset): Readings chosen where the description was open to more than one.
            warnings (list[str] | Unset): Parts of the description the rule does not express.
            compiled_by (str | Unset): Who produced the tree, as the caller states it (not verified): the compile response's
                compiled_by, or member when you wrote or edited it yourself. Defaults to member.
     """

    name: str
    english: str
    tree: CreateEmailRuleRequestTree
    explanation: str
    state: CreateEmailRuleRequestState | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_email_rule_request_tree import CreateEmailRuleRequestTree # noqa: PLC0415
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
        from ..models.create_email_rule_request_tree import CreateEmailRuleRequestTree # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name")

        english = d.pop("english")

        tree = CreateEmailRuleRequestTree.from_dict(d.pop("tree"))




        explanation = d.pop("explanation")

        _state = d.pop("state", UNSET)
        state: CreateEmailRuleRequestState | Unset
        if isinstance(_state,  Unset):
            state = UNSET
        else:
            state = CreateEmailRuleRequestState(_state)




        assumptions = cast(list[str], d.pop("assumptions", UNSET))


        warnings = cast(list[str], d.pop("warnings", UNSET))


        compiled_by = d.pop("compiled_by", UNSET)

        create_email_rule_request = cls(
            name=name,
            english=english,
            tree=tree,
            explanation=explanation,
            state=state,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
        )

        return create_email_rule_request

