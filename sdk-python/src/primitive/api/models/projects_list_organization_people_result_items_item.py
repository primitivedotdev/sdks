from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.projects_list_organization_people_result_items_item_role import ProjectsListOrganizationPeopleResultItemsItemRole
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.projects_list_organization_people_result_items_item_agents_item import ProjectsListOrganizationPeopleResultItemsItemAgentsItem





T = TypeVar("T", bound="ProjectsListOrganizationPeopleResultItemsItem")



@_attrs_define
class ProjectsListOrganizationPeopleResultItemsItem:
    """ 
        Attributes:
            user_id (UUID):
            name (str):
            work_email (None | str):
            role (ProjectsListOrganizationPeopleResultItemsItemRole):
            role_name (str):
            role_id (None | UUID): The id of the person's own template or custom role, as GET /v1/roles lists it and PUT
                /v1/members/{id}/role accepts. Null when they have none: a built-in role, or (with role restricted) access from
                groups only.
            agents (list[ProjectsListOrganizationPeopleResultItemsItemAgentsItem]):
     """

    user_id: UUID
    name: str
    work_email: None | str
    role: ProjectsListOrganizationPeopleResultItemsItemRole
    role_name: str
    role_id: None | UUID
    agents: list[ProjectsListOrganizationPeopleResultItemsItemAgentsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.projects_list_organization_people_result_items_item_agents_item import ProjectsListOrganizationPeopleResultItemsItemAgentsItem # noqa: PLC0415
        user_id = str(self.user_id)

        name = self.name

        work_email: None | str
        work_email = self.work_email

        role = self.role.value

        role_name = self.role_name

        role_id: None | str
        if isinstance(self.role_id, UUID):
            role_id = str(self.role_id)
        else:
            role_id = self.role_id

        agents = []
        for agents_item_data in self.agents:
            agents_item = agents_item_data.to_dict()
            agents.append(agents_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "user_id": user_id,
            "name": name,
            "work_email": work_email,
            "role": role,
            "role_name": role_name,
            "role_id": role_id,
            "agents": agents,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.projects_list_organization_people_result_items_item_agents_item import ProjectsListOrganizationPeopleResultItemsItemAgentsItem # noqa: PLC0415
        d = dict(src_dict)
        user_id = UUID(d.pop("user_id"))




        name = d.pop("name")

        def _parse_work_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        work_email = _parse_work_email(d.pop("work_email"))


        role = ProjectsListOrganizationPeopleResultItemsItemRole(d.pop("role"))




        role_name = d.pop("role_name")

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


        agents = []
        _agents = d.pop("agents")
        for agents_item_data in (_agents):
            agents_item = ProjectsListOrganizationPeopleResultItemsItemAgentsItem.from_dict(agents_item_data)



            agents.append(agents_item)


        projects_list_organization_people_result_items_item = cls(
            user_id=user_id,
            name=name,
            work_email=work_email,
            role=role,
            role_name=role_name,
            role_id=role_id,
            agents=agents,
        )


        projects_list_organization_people_result_items_item.additional_properties = d
        return projects_list_organization_people_result_items_item

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
