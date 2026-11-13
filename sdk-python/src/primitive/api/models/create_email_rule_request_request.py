from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_email_rule_request_request_kind import CreateEmailRuleRequestRequestKind
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_breadth import EmailRuleBreadth
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
            target_email (str | Unset): The member asked for the rule, by their member mailbox address, or by their verified
                work email if you can list members. Give target_user_id or target_email, not both. Looking members up by address
                is limited to 30 an hour, and unless you can list members the answer does not say who it was.
            message (None | str | Unset): A short note to the member asked about why you are asking, up to 500 characters;
                null or absent for none. They see it with the request; it cannot be changed later.
            explanation (str | Unset): What the rule matches, in plain English. Left out, the server writes one from the
                tree.
            assumptions (list[str] | Unset): The compile response's assumptions. Stored as sent.
            warnings (list[str] | Unset): The compile response's warnings. Stored as sent, then any server note they lack on
                an address or domain the description names that the rule does not test (on a rule request, every compiler note
                on the rule).
            compiled_by (str | Unset): Who produced the tree (not verified): the compile response's compiled_by, or member
                (the default) for a tree you wrote or edited.
            breadth (EmailRuleBreadth | None | Unset): Ignored (the compile answer's breadth).
            conditions_breadth (EmailRuleBreadth | None | Unset): Ignored.
            kind (CreateEmailRuleRequestRequestKind | Unset): Only grant.
     """

    name: str
    english: str
    tree: EmailRuleTreeInput
    target_user_id: UUID | Unset = UNSET
    target_email: str | Unset = UNSET
    message: None | str | Unset = UNSET
    explanation: str | Unset = UNSET
    assumptions: list[str] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    compiled_by: str | Unset = UNSET
    breadth: EmailRuleBreadth | None | Unset = UNSET
    conditions_breadth: EmailRuleBreadth | None | Unset = UNSET
    kind: CreateEmailRuleRequestRequestKind | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        name = self.name

        english = self.english

        tree = self.tree.to_dict()

        target_user_id: str | Unset = UNSET
        if not isinstance(self.target_user_id, Unset):
            target_user_id = str(self.target_user_id)

        target_email = self.target_email

        message: None | str | Unset
        if isinstance(self.message, Unset):
            message = UNSET
        else:
            message = self.message

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

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value



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
        if message is not UNSET:
            field_dict["message"] = message
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
        if kind is not UNSET:
            field_dict["kind"] = kind

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
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

        def _parse_message(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message = _parse_message(d.pop("message", UNSET))


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


        _kind = d.pop("kind", UNSET)
        kind: CreateEmailRuleRequestRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = CreateEmailRuleRequestRequestKind(_kind)




        create_email_rule_request_request = cls(
            name=name,
            english=english,
            tree=tree,
            target_user_id=target_user_id,
            target_email=target_email,
            message=message,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
            breadth=breadth,
            conditions_breadth=conditions_breadth,
            kind=kind,
        )

        return create_email_rule_request_request

