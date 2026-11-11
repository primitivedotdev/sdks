from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_withheld_by_reason import EmailRuleWithheldByReason
from uuid import UUID






T = TypeVar("T", bound="EmailRuleWithheldBy")



@_attrs_define
class EmailRuleWithheldBy:
    """ 
        Attributes:
            id (UUID):
            name (str):
            reason (EmailRuleWithheldByReason): undecided: it had not decided the email, which blocks too.
                outside_scope_stale: cleared as outside its scope, and its author now reads the email.
     """

    id: UUID
    name: str
    reason: EmailRuleWithheldByReason
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        reason = self.reason.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "reason": reason,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        reason = EmailRuleWithheldByReason(d.pop("reason"))




        email_rule_withheld_by = cls(
            id=id,
            name=name,
            reason=reason,
        )


        email_rule_withheld_by.additional_properties = d
        return email_rule_withheld_by

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
