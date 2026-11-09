from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.projects_update_project_input_members_item_recipient import ProjectsUpdateProjectInputMembersItemRecipient





T = TypeVar("T", bound="ProjectsUpdateProjectInputMembersItem")



@_attrs_define
class ProjectsUpdateProjectInputMembersItem:
    """ 
        Attributes:
            user_id (UUID):
            recipient (ProjectsUpdateProjectInputMembersItemRecipient):
     """

    user_id: UUID
    recipient: ProjectsUpdateProjectInputMembersItemRecipient





    def to_dict(self) -> dict[str, Any]:
        from ..models.projects_update_project_input_members_item_recipient import ProjectsUpdateProjectInputMembersItemRecipient # noqa: PLC0415
        user_id = str(self.user_id)

        recipient = self.recipient.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "user_id": user_id,
            "recipient": recipient,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.projects_update_project_input_members_item_recipient import ProjectsUpdateProjectInputMembersItemRecipient # noqa: PLC0415
        d = dict(src_dict)
        user_id = UUID(d.pop("user_id"))




        recipient = ProjectsUpdateProjectInputMembersItemRecipient.from_dict(d.pop("recipient"))




        projects_update_project_input_members_item = cls(
            user_id=user_id,
            recipient=recipient,
        )

        return projects_update_project_input_members_item

