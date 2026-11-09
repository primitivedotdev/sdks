from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.projects_invite_organization_member_result_role_kind import ProjectsInviteOrganizationMemberResultRoleKind
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="ProjectsInviteOrganizationMemberResultRole")



@_attrs_define
class ProjectsInviteOrganizationMemberResultRole:
    """ 
        Attributes:
            kind (ProjectsInviteOrganizationMemberResultRoleKind):
            key (None | str):
            role_id (None | UUID):
     """

    kind: ProjectsInviteOrganizationMemberResultRoleKind
    key: None | str
    role_id: None | UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        key: None | str
        key = self.key

        role_id: None | str
        if isinstance(self.role_id, UUID):
            role_id = str(self.role_id)
        else:
            role_id = self.role_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "key": key,
            "role_id": role_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = ProjectsInviteOrganizationMemberResultRoleKind(d.pop("kind"))




        def _parse_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        key = _parse_key(d.pop("key"))


        def _parse_role_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                role_id_type_0 = UUID(data)



                return role_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        role_id = _parse_role_id(d.pop("role_id"))


        projects_invite_organization_member_result_role = cls(
            kind=kind,
            key=key,
            role_id=role_id,
        )


        projects_invite_organization_member_result_role.additional_properties = d
        return projects_invite_organization_member_result_role

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
