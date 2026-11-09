from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.projects_update_project_input_members_item import ProjectsUpdateProjectInputMembersItem





T = TypeVar("T", bound="ProjectsUpdateProjectInput")



@_attrs_define
class ProjectsUpdateProjectInput:
    """ 
        Attributes:
            version (int):
            name (str):
            color (str):
            members (list[ProjectsUpdateProjectInputMembersItem]):
            agent_addresses (list[str]):
            description (str | Unset):  Default: ''.
            repository (None | str | Unset):
     """

    version: int
    name: str
    color: str
    members: list[ProjectsUpdateProjectInputMembersItem]
    agent_addresses: list[str]
    description: str | Unset = ''
    repository: None | str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.projects_update_project_input_members_item import ProjectsUpdateProjectInputMembersItem # noqa: PLC0415
        version = self.version

        name = self.name

        color = self.color

        members = []
        for members_item_data in self.members:
            members_item = members_item_data.to_dict()
            members.append(members_item)



        agent_addresses = self.agent_addresses



        description = self.description

        repository: None | str | Unset
        if isinstance(self.repository, Unset):
            repository = UNSET
        else:
            repository = self.repository


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "version": version,
            "name": name,
            "color": color,
            "members": members,
            "agent_addresses": agent_addresses,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if repository is not UNSET:
            field_dict["repository"] = repository

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.projects_update_project_input_members_item import ProjectsUpdateProjectInputMembersItem # noqa: PLC0415
        d = dict(src_dict)
        version = d.pop("version")

        name = d.pop("name")

        color = d.pop("color")

        members = []
        _members = d.pop("members")
        for members_item_data in (_members):
            members_item = ProjectsUpdateProjectInputMembersItem.from_dict(members_item_data)



            members.append(members_item)


        agent_addresses = cast(list[str], d.pop("agent_addresses"))


        description = d.pop("description", UNSET)

        def _parse_repository(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        repository = _parse_repository(d.pop("repository", UNSET))


        projects_update_project_input = cls(
            version=version,
            name=name,
            color=color,
            members=members,
            agent_addresses=agent_addresses,
            description=description,
            repository=repository,
        )

        return projects_update_project_input

