from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_roles_result_assignment import ListRolesResultAssignment
  from ..models.list_roles_result_invitations import ListRolesResultInvitations
  from ..models.list_roles_result_roles_item import ListRolesResultRolesItem
  from ..models.list_roles_result_templates_item import ListRolesResultTemplatesItem





T = TypeVar("T", bound="ListRolesResult")



@_attrs_define
class ListRolesResult:
    """ 
        Attributes:
            roles (list[ListRolesResultRolesItem]):
            templates (list[ListRolesResultTemplatesItem]):
            assignment (ListRolesResultAssignment):
            invitations (ListRolesResultInvitations | Unset):
     """

    roles: list[ListRolesResultRolesItem]
    templates: list[ListRolesResultTemplatesItem]
    assignment: ListRolesResultAssignment
    invitations: ListRolesResultInvitations | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_roles_result_assignment import ListRolesResultAssignment # noqa: PLC0415
        from ..models.list_roles_result_invitations import ListRolesResultInvitations # noqa: PLC0415
        from ..models.list_roles_result_roles_item import ListRolesResultRolesItem # noqa: PLC0415
        from ..models.list_roles_result_templates_item import ListRolesResultTemplatesItem # noqa: PLC0415
        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.to_dict()
            roles.append(roles_item)



        templates = []
        for templates_item_data in self.templates:
            templates_item = templates_item_data.to_dict()
            templates.append(templates_item)



        assignment = self.assignment.to_dict()

        invitations: dict[str, Any] | Unset = UNSET
        if not isinstance(self.invitations, Unset):
            invitations = self.invitations.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "roles": roles,
            "templates": templates,
            "assignment": assignment,
        })
        if invitations is not UNSET:
            field_dict["invitations"] = invitations

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_roles_result_assignment import ListRolesResultAssignment # noqa: PLC0415
        from ..models.list_roles_result_invitations import ListRolesResultInvitations # noqa: PLC0415
        from ..models.list_roles_result_roles_item import ListRolesResultRolesItem # noqa: PLC0415
        from ..models.list_roles_result_templates_item import ListRolesResultTemplatesItem # noqa: PLC0415
        d = dict(src_dict)
        roles = []
        _roles = d.pop("roles")
        for roles_item_data in (_roles):
            roles_item = ListRolesResultRolesItem.from_dict(roles_item_data)



            roles.append(roles_item)


        templates = []
        _templates = d.pop("templates")
        for templates_item_data in (_templates):
            templates_item = ListRolesResultTemplatesItem.from_dict(templates_item_data)



            templates.append(templates_item)


        assignment = ListRolesResultAssignment.from_dict(d.pop("assignment"))




        _invitations = d.pop("invitations", UNSET)
        invitations: ListRolesResultInvitations | Unset
        if isinstance(_invitations,  Unset):
            invitations = UNSET
        else:
            invitations = ListRolesResultInvitations.from_dict(_invitations)




        list_roles_result = cls(
            roles=roles,
            templates=templates,
            assignment=assignment,
            invitations=invitations,
        )


        list_roles_result.additional_properties = d
        return list_roles_result

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
