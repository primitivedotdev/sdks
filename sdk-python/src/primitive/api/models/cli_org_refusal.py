from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.cli_org_refusal_reason import CliOrgRefusalReason
from uuid import UUID






T = TypeVar("T", bound="CliOrgRefusal")



@_attrs_define
class CliOrgRefusal:
    """ 
        Attributes:
            org_id (UUID):
            reason (CliOrgRefusalReason): Why the CLI cannot be used in an organization:
                `not_a_member`, `cli_access_disabled_by_org`, `role_insufficient`
                (the organization's policy does not allow the person's role), or
                `cli_access_revoked` (log in again).
            message (str):
     """

    org_id: UUID
    reason: CliOrgRefusalReason
    message: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        org_id = str(self.org_id)

        reason = self.reason.value

        message = self.message


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "org_id": org_id,
            "reason": reason,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        org_id = UUID(d.pop("org_id"))




        reason = CliOrgRefusalReason(d.pop("reason"))




        message = d.pop("message")

        cli_org_refusal = cls(
            org_id=org_id,
            reason=reason,
            message=message,
        )


        cli_org_refusal.additional_properties = d
        return cli_org_refusal

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
