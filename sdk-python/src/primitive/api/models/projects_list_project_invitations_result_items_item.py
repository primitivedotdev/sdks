from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.projects_list_project_invitations_result_items_item_delivery import ProjectsListProjectInvitationsResultItemsItemDelivery
from ..models.projects_list_project_invitations_result_items_item_failure_reason import ProjectsListProjectInvitationsResultItemsItemFailureReason
from ..models.projects_list_project_invitations_result_items_item_revoked_reason_type_1 import ProjectsListProjectInvitationsResultItemsItemRevokedReasonType1
from ..models.projects_list_project_invitations_result_items_item_revoked_reason_type_2_type_1 import ProjectsListProjectInvitationsResultItemsItemRevokedReasonType2Type1
from ..models.projects_list_project_invitations_result_items_item_revoked_reason_type_3_type_1 import ProjectsListProjectInvitationsResultItemsItemRevokedReasonType3Type1
from ..models.projects_list_project_invitations_result_items_item_status import ProjectsListProjectInvitationsResultItemsItemStatus
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="ProjectsListProjectInvitationsResultItemsItem")



@_attrs_define
class ProjectsListProjectInvitationsResultItemsItem:
    """ 
        Attributes:
            id (UUID):
            project_id (UUID):
            email (str):
            status (ProjectsListProjectInvitationsResultItemsItemStatus):
            delivery (ProjectsListProjectInvitationsResultItemsItemDelivery):
            expires_at (None | str):
            revoked_reason (None | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType1 |
                ProjectsListProjectInvitationsResultItemsItemRevokedReasonType2Type1 |
                ProjectsListProjectInvitationsResultItemsItemRevokedReasonType3Type1 | Unset):
            failure_reason (ProjectsListProjectInvitationsResultItemsItemFailureReason | Unset):
     """

    id: UUID
    project_id: UUID
    email: str
    status: ProjectsListProjectInvitationsResultItemsItemStatus
    delivery: ProjectsListProjectInvitationsResultItemsItemDelivery
    expires_at: None | str
    revoked_reason: None | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType1 | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType2Type1 | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType3Type1 | Unset = UNSET
    failure_reason: ProjectsListProjectInvitationsResultItemsItemFailureReason | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        project_id = str(self.project_id)

        email = self.email

        status = self.status.value

        delivery = self.delivery.value

        expires_at: None | str
        expires_at = self.expires_at

        revoked_reason: None | str | Unset
        if isinstance(self.revoked_reason, Unset):
            revoked_reason = UNSET
        elif isinstance(self.revoked_reason, ProjectsListProjectInvitationsResultItemsItemRevokedReasonType1):
            revoked_reason = self.revoked_reason.value
        elif isinstance(self.revoked_reason, ProjectsListProjectInvitationsResultItemsItemRevokedReasonType2Type1):
            revoked_reason = self.revoked_reason.value
        elif isinstance(self.revoked_reason, ProjectsListProjectInvitationsResultItemsItemRevokedReasonType3Type1):
            revoked_reason = self.revoked_reason.value
        else:
            revoked_reason = self.revoked_reason

        failure_reason: str | Unset = UNSET
        if not isinstance(self.failure_reason, Unset):
            failure_reason = self.failure_reason.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "project_id": project_id,
            "email": email,
            "status": status,
            "delivery": delivery,
            "expires_at": expires_at,
        })
        if revoked_reason is not UNSET:
            field_dict["revoked_reason"] = revoked_reason
        if failure_reason is not UNSET:
            field_dict["failure_reason"] = failure_reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        project_id = UUID(d.pop("project_id"))




        email = d.pop("email")

        status = ProjectsListProjectInvitationsResultItemsItemStatus(d.pop("status"))




        delivery = ProjectsListProjectInvitationsResultItemsItemDelivery(d.pop("delivery"))




        def _parse_expires_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        def _parse_revoked_reason(data: object) -> None | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType1 | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType2Type1 | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType3Type1 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                revoked_reason_type_1 = ProjectsListProjectInvitationsResultItemsItemRevokedReasonType1(data)



                return revoked_reason_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                revoked_reason_type_2_type_1 = ProjectsListProjectInvitationsResultItemsItemRevokedReasonType2Type1(data)



                return revoked_reason_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                revoked_reason_type_3_type_1 = ProjectsListProjectInvitationsResultItemsItemRevokedReasonType3Type1(data)



                return revoked_reason_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType1 | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType2Type1 | ProjectsListProjectInvitationsResultItemsItemRevokedReasonType3Type1 | Unset, data)

        revoked_reason = _parse_revoked_reason(d.pop("revoked_reason", UNSET))


        _failure_reason = d.pop("failure_reason", UNSET)
        failure_reason: ProjectsListProjectInvitationsResultItemsItemFailureReason | Unset
        if isinstance(_failure_reason,  Unset):
            failure_reason = UNSET
        else:
            failure_reason = ProjectsListProjectInvitationsResultItemsItemFailureReason(_failure_reason)




        projects_list_project_invitations_result_items_item = cls(
            id=id,
            project_id=project_id,
            email=email,
            status=status,
            delivery=delivery,
            expires_at=expires_at,
            revoked_reason=revoked_reason,
            failure_reason=failure_reason,
        )


        projects_list_project_invitations_result_items_item.additional_properties = d
        return projects_list_project_invitations_result_items_item

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
