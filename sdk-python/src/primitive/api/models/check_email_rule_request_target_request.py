from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="CheckEmailRuleRequestTargetRequest")



@_attrs_define
class CheckEmailRuleRequestTargetRequest:
    """ 
        Attributes:
            target_user_id (UUID | Unset): The member to ask. Give target_user_id or target_email, not both.
            target_email (str | Unset): The member to ask, by their member mailbox address. Give target_user_id or
                target_email, not both. Counts toward the same 30 lookups by address an hour as asking.
     """

    target_user_id: UUID | Unset = UNSET
    target_email: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        target_user_id: str | Unset = UNSET
        if not isinstance(self.target_user_id, Unset):
            target_user_id = str(self.target_user_id)

        target_email = self.target_email


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if target_user_id is not UNSET:
            field_dict["target_user_id"] = target_user_id
        if target_email is not UNSET:
            field_dict["target_email"] = target_email

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _target_user_id = d.pop("target_user_id", UNSET)
        target_user_id: UUID | Unset
        if isinstance(_target_user_id,  Unset):
            target_user_id = UNSET
        else:
            target_user_id = UUID(_target_user_id)




        target_email = d.pop("target_email", UNSET)

        check_email_rule_request_target_request = cls(
            target_user_id=target_user_id,
            target_email=target_email,
        )

        return check_email_rule_request_target_request

