from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.projects_list_organization_people_result_items_item import ProjectsListOrganizationPeopleResultItemsItem





T = TypeVar("T", bound="ProjectsListOrganizationPeopleResult")



@_attrs_define
class ProjectsListOrganizationPeopleResult:
    """ 
        Attributes:
            items (list[ProjectsListOrganizationPeopleResultItemsItem]):
            cursor (None | UUID):
            can_invite (bool):
     """

    items: list[ProjectsListOrganizationPeopleResultItemsItem]
    cursor: None | UUID
    can_invite: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.projects_list_organization_people_result_items_item import ProjectsListOrganizationPeopleResultItemsItem # noqa: PLC0415
        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)



        cursor: None | str
        if isinstance(self.cursor, UUID):
            cursor = str(self.cursor)
        else:
            cursor = self.cursor

        can_invite = self.can_invite


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "items": items,
            "cursor": cursor,
            "can_invite": can_invite,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.projects_list_organization_people_result_items_item import ProjectsListOrganizationPeopleResultItemsItem # noqa: PLC0415
        d = dict(src_dict)
        items = []
        _items = d.pop("items")
        for items_item_data in (_items):
            items_item = ProjectsListOrganizationPeopleResultItemsItem.from_dict(items_item_data)



            items.append(items_item)


        def _parse_cursor(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                cursor_type_0 = UUID(data)



                return cursor_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        cursor = _parse_cursor(d.pop("cursor"))


        can_invite = d.pop("can_invite")

        projects_list_organization_people_result = cls(
            items=items,
            cursor=cursor,
            can_invite=can_invite,
        )


        projects_list_organization_people_result.additional_properties = d
        return projects_list_organization_people_result

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
