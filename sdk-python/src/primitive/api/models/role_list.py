from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.role import Role
  from ..models.role_list_assignment import RoleListAssignment
  from ..models.role_template import RoleTemplate





T = TypeVar("T", bound="RoleList")



@_attrs_define
class RoleList:
    """ 
        Attributes:
            roles (list[Role]):
            templates (list[RoleTemplate]):
            assignment (RoleListAssignment):
     """

    roles: list[Role]
    templates: list[RoleTemplate]
    assignment: RoleListAssignment
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.role import Role # noqa: PLC0415
        from ..models.role_list_assignment import RoleListAssignment # noqa: PLC0415
        from ..models.role_template import RoleTemplate # noqa: PLC0415
        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.to_dict()
            roles.append(roles_item)



        templates = []
        for templates_item_data in self.templates:
            templates_item = templates_item_data.to_dict()
            templates.append(templates_item)



        assignment = self.assignment.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "roles": roles,
            "templates": templates,
            "assignment": assignment,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.role import Role # noqa: PLC0415
        from ..models.role_list_assignment import RoleListAssignment # noqa: PLC0415
        from ..models.role_template import RoleTemplate # noqa: PLC0415
        d = dict(src_dict)
        roles = []
        _roles = d.pop("roles")
        for roles_item_data in (_roles):
            roles_item = Role.from_dict(roles_item_data)



            roles.append(roles_item)


        templates = []
        _templates = d.pop("templates")
        for templates_item_data in (_templates):
            templates_item = RoleTemplate.from_dict(templates_item_data)



            templates.append(templates_item)


        assignment = RoleListAssignment.from_dict(d.pop("assignment"))




        role_list = cls(
            roles=roles,
            templates=templates,
            assignment=assignment,
        )


        role_list.additional_properties = d
        return role_list

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
