from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_scope_warning_kind import EmailRuleScopeWarningKind
from ..models.email_rule_scope_warning_reason import EmailRuleScopeWarningReason






T = TypeVar("T", bound="EmailRuleScopeWarning")



@_attrs_define
class EmailRuleScopeWarning:
    """ 
        Attributes:
            name (str):
            kind (EmailRuleScopeWarningKind):
            reason (EmailRuleScopeWarningReason): unknown_domain: none of the organization's domains. inactive_domain: one
                of its domains, not active now, so no new mail arrives. unknown_address: no inbox known as someone's, and no
                mail has reached it yet.
            message (str):
     """

    name: str
    kind: EmailRuleScopeWarningKind
    reason: EmailRuleScopeWarningReason
    message: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        kind = self.kind.value

        reason = self.reason.value

        message = self.message


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "kind": kind,
            "reason": reason,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        kind = EmailRuleScopeWarningKind(d.pop("kind"))




        reason = EmailRuleScopeWarningReason(d.pop("reason"))




        message = d.pop("message")

        email_rule_scope_warning = cls(
            name=name,
            kind=kind,
            reason=reason,
            message=message,
        )


        email_rule_scope_warning.additional_properties = d
        return email_rule_scope_warning

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
