from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CreateEmailRuleObjectionRequest")



@_attrs_define
class CreateEmailRuleObjectionRequest:
    """ 
        Attributes:
            rule_id (UUID): A rule that covers one of your own mailboxes now (GET /email-rules/covering-me), written by
                another member.
            message (None | str | Unset): Why you object and what you ask, up to 500 characters: to turn the rule off, to
                narrow it, or to explain who receives what it matches. Null or absent for none. The rule's author and the
                organization's owners and admins see it while it stands, and an email to the author about the objection quotes
                it. Withdrawing clears it from the objection, not from an email already sent or being sent.
     """

    rule_id: UUID
    message: None | str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        rule_id = str(self.rule_id)

        message: None | str | Unset
        if isinstance(self.message, Unset):
            message = UNSET
        else:
            message = self.message


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "rule_id": rule_id,
        })
        if message is not UNSET:
            field_dict["message"] = message

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        rule_id = UUID(d.pop("rule_id"))




        def _parse_message(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message = _parse_message(d.pop("message", UNSET))


        create_email_rule_objection_request = cls(
            rule_id=rule_id,
            message=message,
        )

        return create_email_rule_objection_request

