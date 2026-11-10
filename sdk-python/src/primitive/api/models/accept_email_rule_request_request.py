from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
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
            assumptions (list[str] | Unset): Readings chosen where the description was open to more than one, as the compile
                response returned them (including its lines naming any condition, question or confidence bar the description did
                not ask for). Stored as sent.
            warnings (list[str] | Unset): Parts of the description the rule does not express, as the compile response
                returned them (including its notes on what the automated and from_mailing_list columns read). Stored as sent.
            compiled_by (str | Unset): Who produced the tree (not verified): the compile response's compiled_by, or member
                (the default) for a tree you wrote or edited.
     """

    name: str | Unset = UNSET
    english: str | Unset = UNSET
    tree: EmailRuleTreeInput | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
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

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
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

        accept_email_rule_request_request = cls(
            name=name,
            english=english,
            tree=tree,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
        )

        return accept_email_rule_request_request

