from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_tree_input import EmailRuleTreeInput





T = TypeVar("T", bound="CreateEmailRuleRequestRequest")



@_attrs_define
class CreateEmailRuleRequestRequest:
    """ 
        Attributes:
            name (str): A short name for the rule.
            english (str): The plain-English description the rule was compiled from.
            tree (EmailRuleTreeInput):
            target_user_id (UUID | Unset): The member asked for the rule. Give target_user_id or target_email, not both.
            target_email (str | Unset): The member asked for the rule, by their member mailbox address. Give target_user_id
                or target_email, not both. Looking members up by address is limited to 30 an hour, and unless you can list
                members the answer does not say who it was.
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

    name: str
    english: str
    tree: EmailRuleTreeInput
    target_user_id: UUID | Unset = UNSET
    target_email: str | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        name = self.name

        english = self.english

        tree = self.tree.to_dict()

        target_user_id: str | Unset = UNSET
        if not isinstance(self.target_user_id, Unset):
            target_user_id = str(self.target_user_id)

        target_email = self.target_email

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
            "name": name,
            "english": english,
            "tree": tree,
        })
        if target_user_id is not UNSET:
            field_dict["target_user_id"] = target_user_id
        if target_email is not UNSET:
            field_dict["target_email"] = target_email
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
        name = d.pop("name")

        english = d.pop("english")

        tree = EmailRuleTreeInput.from_dict(d.pop("tree"))




        _target_user_id = d.pop("target_user_id", UNSET)
        target_user_id: UUID | Unset
        if isinstance(_target_user_id,  Unset):
            target_user_id = UNSET
        else:
            target_user_id = UUID(_target_user_id)




        target_email = d.pop("target_email", UNSET)

        explanation = d.pop("explanation", UNSET)

        assumptions = cast(list[str], d.pop("assumptions", UNSET))


        warnings = cast(list[str], d.pop("warnings", UNSET))


        compiled_by = d.pop("compiled_by", UNSET)

        create_email_rule_request_request = cls(
            name=name,
            english=english,
            tree=tree,
            target_user_id=target_user_id,
            target_email=target_email,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
        )

        return create_email_rule_request_request

