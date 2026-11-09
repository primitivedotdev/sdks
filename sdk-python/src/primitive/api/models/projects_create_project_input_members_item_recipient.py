from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.projects_create_project_input_members_item_recipient_kind import ProjectsCreateProjectInputMembersItemRecipientKind






T = TypeVar("T", bound="ProjectsCreateProjectInputMembersItemRecipient")



@_attrs_define
class ProjectsCreateProjectInputMembersItemRecipient:
    """ 
        Attributes:
            kind (ProjectsCreateProjectInputMembersItemRecipientKind):
            address (str | Unset):
     """

    kind: ProjectsCreateProjectInputMembersItemRecipientKind
    address: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        address = self.address


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
        })
        if address is not UNSET:
            field_dict["address"] = address

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = ProjectsCreateProjectInputMembersItemRecipientKind(d.pop("kind"))




        address = d.pop("address", UNSET)

        projects_create_project_input_members_item_recipient = cls(
            kind=kind,
            address=address,
        )


        projects_create_project_input_members_item_recipient.additional_properties = d
        return projects_create_project_input_members_item_recipient

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
