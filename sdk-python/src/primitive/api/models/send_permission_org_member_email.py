from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.send_permission_org_member_email_type import SendPermissionOrgMemberEmailType






T = TypeVar("T", bound="SendPermissionOrgMemberEmail")



@_attrs_define
class SendPermissionOrgMemberEmail:
    """ The caller can send to the signup email of a member of its organization. Emitted once per member the caller can see.

        Attributes:
            type_ (SendPermissionOrgMemberEmailType):
            address (str): The member's signup email address.
            description (str): Human-prose summary of the rule.
     """

    type_: SendPermissionOrgMemberEmailType
    address: str
    description: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        address = self.address

        description = self.description


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "address": address,
            "description": description,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = SendPermissionOrgMemberEmailType(d.pop("type"))




        address = d.pop("address")

        description = d.pop("description")

        send_permission_org_member_email = cls(
            type_=type_,
            address=address,
            description=description,
        )


        send_permission_org_member_email.additional_properties = d
        return send_permission_org_member_email

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
