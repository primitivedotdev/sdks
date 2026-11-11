from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ProjectsListOrganizationPeopleResultItemsItemMailAccess")



@_attrs_define
class ProjectsListOrganizationPeopleResultItemsItemMailAccess:
    """ What their access lets them do with mail now. read false: they cannot read mail here; their role must give mail:read
    (in delegated mode they also need their own mailbox or an access entry). Only for a caller holding members:read;
    absent when it could not be read in time.

        Attributes:
            read (bool): Holds mail:read, over every mailbox or only some.
            send (bool): Holds mail:send, from every address or only some.
     """

    read: bool
    send: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        read = self.read

        send = self.send


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "read": read,
            "send": send,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        read = d.pop("read")

        send = d.pop("send")

        projects_list_organization_people_result_items_item_mail_access = cls(
            read=read,
            send=send,
        )


        projects_list_organization_people_result_items_item_mail_access.additional_properties = d
        return projects_list_organization_people_result_items_item_mail_access

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
