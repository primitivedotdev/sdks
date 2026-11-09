from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.projects_invite_organization_member_result_delivery import ProjectsInviteOrganizationMemberResultDelivery
from ..models.projects_invite_organization_member_result_failure_reason import ProjectsInviteOrganizationMemberResultFailureReason
from ..models.projects_invite_organization_member_result_revoked_reason_type_1 import ProjectsInviteOrganizationMemberResultRevokedReasonType1
from ..models.projects_invite_organization_member_result_revoked_reason_type_2_type_1 import ProjectsInviteOrganizationMemberResultRevokedReasonType2Type1
from ..models.projects_invite_organization_member_result_revoked_reason_type_3_type_1 import ProjectsInviteOrganizationMemberResultRevokedReasonType3Type1
from ..models.projects_invite_organization_member_result_status import ProjectsInviteOrganizationMemberResultStatus
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.projects_invite_organization_member_result_role import ProjectsInviteOrganizationMemberResultRole





T = TypeVar("T", bound="ProjectsInviteOrganizationMemberResult")



@_attrs_define
class ProjectsInviteOrganizationMemberResult:
    """ 
        Attributes:
            id (UUID):
            email (str):
            status (ProjectsInviteOrganizationMemberResultStatus):
            delivery (ProjectsInviteOrganizationMemberResultDelivery):
            expires_at (None | str):
            revoked_reason (None | ProjectsInviteOrganizationMemberResultRevokedReasonType1 |
                ProjectsInviteOrganizationMemberResultRevokedReasonType2Type1 |
                ProjectsInviteOrganizationMemberResultRevokedReasonType3Type1 | Unset):
            failure_reason (ProjectsInviteOrganizationMemberResultFailureReason | Unset):
            role (ProjectsInviteOrganizationMemberResultRole | Unset):
     """

    id: UUID
    email: str
    status: ProjectsInviteOrganizationMemberResultStatus
    delivery: ProjectsInviteOrganizationMemberResultDelivery
    expires_at: None | str
    revoked_reason: None | ProjectsInviteOrganizationMemberResultRevokedReasonType1 | ProjectsInviteOrganizationMemberResultRevokedReasonType2Type1 | ProjectsInviteOrganizationMemberResultRevokedReasonType3Type1 | Unset = UNSET
    failure_reason: ProjectsInviteOrganizationMemberResultFailureReason | Unset = UNSET
    role: ProjectsInviteOrganizationMemberResultRole | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.projects_invite_organization_member_result_role import ProjectsInviteOrganizationMemberResultRole # noqa: PLC0415
        id = str(self.id)

        email = self.email

        status = self.status.value

        delivery = self.delivery.value

        expires_at: None | str
        expires_at = self.expires_at

        revoked_reason: None | str | Unset
        if isinstance(self.revoked_reason, Unset):
            revoked_reason = UNSET
        elif isinstance(self.revoked_reason, ProjectsInviteOrganizationMemberResultRevokedReasonType1):
            revoked_reason = self.revoked_reason.value
        elif isinstance(self.revoked_reason, ProjectsInviteOrganizationMemberResultRevokedReasonType2Type1):
            revoked_reason = self.revoked_reason.value
        elif isinstance(self.revoked_reason, ProjectsInviteOrganizationMemberResultRevokedReasonType3Type1):
            revoked_reason = self.revoked_reason.value
        else:
            revoked_reason = self.revoked_reason

        failure_reason: str | Unset = UNSET
        if not isinstance(self.failure_reason, Unset):
            failure_reason = self.failure_reason.value


        role: dict[str, Any] | Unset = UNSET
        if not isinstance(self.role, Unset):
            role = self.role.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "email": email,
            "status": status,
            "delivery": delivery,
            "expires_at": expires_at,
        })
        if revoked_reason is not UNSET:
            field_dict["revoked_reason"] = revoked_reason
        if failure_reason is not UNSET:
            field_dict["failure_reason"] = failure_reason
        if role is not UNSET:
            field_dict["role"] = role

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.projects_invite_organization_member_result_role import ProjectsInviteOrganizationMemberResultRole # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        email = d.pop("email")

        status = ProjectsInviteOrganizationMemberResultStatus(d.pop("status"))




        delivery = ProjectsInviteOrganizationMemberResultDelivery(d.pop("delivery"))




        def _parse_expires_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        def _parse_revoked_reason(data: object) -> None | ProjectsInviteOrganizationMemberResultRevokedReasonType1 | ProjectsInviteOrganizationMemberResultRevokedReasonType2Type1 | ProjectsInviteOrganizationMemberResultRevokedReasonType3Type1 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                revoked_reason_type_1 = ProjectsInviteOrganizationMemberResultRevokedReasonType1(data)



                return revoked_reason_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                revoked_reason_type_2_type_1 = ProjectsInviteOrganizationMemberResultRevokedReasonType2Type1(data)



                return revoked_reason_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                revoked_reason_type_3_type_1 = ProjectsInviteOrganizationMemberResultRevokedReasonType3Type1(data)



                return revoked_reason_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ProjectsInviteOrganizationMemberResultRevokedReasonType1 | ProjectsInviteOrganizationMemberResultRevokedReasonType2Type1 | ProjectsInviteOrganizationMemberResultRevokedReasonType3Type1 | Unset, data)

        revoked_reason = _parse_revoked_reason(d.pop("revoked_reason", UNSET))


        _failure_reason = d.pop("failure_reason", UNSET)
        failure_reason: ProjectsInviteOrganizationMemberResultFailureReason | Unset
        if isinstance(_failure_reason,  Unset):
            failure_reason = UNSET
        else:
            failure_reason = ProjectsInviteOrganizationMemberResultFailureReason(_failure_reason)




        _role = d.pop("role", UNSET)
        role: ProjectsInviteOrganizationMemberResultRole | Unset
        if isinstance(_role,  Unset):
            role = UNSET
        else:
            role = ProjectsInviteOrganizationMemberResultRole.from_dict(_role)




        projects_invite_organization_member_result = cls(
            id=id,
            email=email,
            status=status,
            delivery=delivery,
            expires_at=expires_at,
            revoked_reason=revoked_reason,
            failure_reason=failure_reason,
            role=role,
        )


        projects_invite_organization_member_result.additional_properties = d
        return projects_invite_organization_member_result

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
