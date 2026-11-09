from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="ProjectsInviteOrganizationMemberInput")



@_attrs_define
class ProjectsInviteOrganizationMemberInput:
    """ 
        Attributes:
            request_id (UUID):
            email (str):
            role (str | Unset): The role the person joins with: member (the default), none for no access, admin, a role
                template key or a custom role id. Anything above member, and member where every member reads all of the
                organization's mail, needs a signed-in dashboard session holding roles:assign. owner and restricted are refused.
     """

    request_id: UUID
    email: str
    role: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        request_id = str(self.request_id)

        email = self.email

        role = self.role


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "request_id": request_id,
            "email": email,
        })
        if role is not UNSET:
            field_dict["role"] = role

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        request_id = UUID(d.pop("request_id"))




        email = d.pop("email")

        role = d.pop("role", UNSET)

        projects_invite_organization_member_input = cls(
            request_id=request_id,
            email=email,
            role=role,
        )

        return projects_invite_organization_member_input

