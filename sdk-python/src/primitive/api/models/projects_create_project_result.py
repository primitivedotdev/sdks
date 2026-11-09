from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.projects_create_project_result_access import ProjectsCreateProjectResultAccess
  from ..models.projects_create_project_result_agents_item import ProjectsCreateProjectResultAgentsItem
  from ..models.projects_create_project_result_members_item import ProjectsCreateProjectResultMembersItem





T = TypeVar("T", bound="ProjectsCreateProjectResult")



@_attrs_define
class ProjectsCreateProjectResult:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            repository (None | str):
            color (str):
            version (int):
            members (list[ProjectsCreateProjectResultMembersItem]):
            agents (list[ProjectsCreateProjectResultAgentsItem]):
            access (ProjectsCreateProjectResultAccess):
     """

    id: UUID
    name: str
    description: str
    repository: None | str
    color: str
    version: int
    members: list[ProjectsCreateProjectResultMembersItem]
    agents: list[ProjectsCreateProjectResultAgentsItem]
    access: ProjectsCreateProjectResultAccess
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.projects_create_project_result_access import ProjectsCreateProjectResultAccess # noqa: PLC0415
        from ..models.projects_create_project_result_agents_item import ProjectsCreateProjectResultAgentsItem # noqa: PLC0415
        from ..models.projects_create_project_result_members_item import ProjectsCreateProjectResultMembersItem # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        repository: None | str
        repository = self.repository

        color = self.color

        version = self.version

        members = []
        for members_item_data in self.members:
            members_item = members_item_data.to_dict()
            members.append(members_item)



        agents = []
        for agents_item_data in self.agents:
            agents_item = agents_item_data.to_dict()
            agents.append(agents_item)



        access = self.access.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "repository": repository,
            "color": color,
            "version": version,
            "members": members,
            "agents": agents,
            "access": access,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.projects_create_project_result_access import ProjectsCreateProjectResultAccess # noqa: PLC0415
        from ..models.projects_create_project_result_agents_item import ProjectsCreateProjectResultAgentsItem # noqa: PLC0415
        from ..models.projects_create_project_result_members_item import ProjectsCreateProjectResultMembersItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        def _parse_repository(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        repository = _parse_repository(d.pop("repository"))


        color = d.pop("color")

        version = d.pop("version")

        members = []
        _members = d.pop("members")
        for members_item_data in (_members):
            members_item = ProjectsCreateProjectResultMembersItem.from_dict(members_item_data)



            members.append(members_item)


        agents = []
        _agents = d.pop("agents")
        for agents_item_data in (_agents):
            agents_item = ProjectsCreateProjectResultAgentsItem.from_dict(agents_item_data)



            agents.append(agents_item)


        access = ProjectsCreateProjectResultAccess.from_dict(d.pop("access"))




        projects_create_project_result = cls(
            id=id,
            name=name,
            description=description,
            repository=repository,
            color=color,
            version=version,
            members=members,
            agents=agents,
            access=access,
        )


        projects_create_project_result.additional_properties = d
        return projects_create_project_result

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
