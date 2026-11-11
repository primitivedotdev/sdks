from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="ListActivityObjectsResultItemsItemCreatedThrough")



@_attrs_define
class ListActivityObjectsResultItemsItemCreatedThrough:
    """ 
        Attributes:
            kind (str): The kind of credential it was created through: org_key, function_key, connected_key, oauth,
                agent_delegate or member (the person themselves). With relation=asked, member: the member who asked.
            id (None | str): In a person's view, the person's own user id for member, and an API key's id where they may
                read their keys (for a person limited to their own keys, only a key they still hold). Null otherwise, and always
                null in one credential's view, where it is the calling credential itself. With relation=asked, the user id of
                the member who asked.
            name (None | str): In a person's view, what that credential of theirs is called: an app login by its app, an API
                key by its name, an agent's key by its address. Null otherwise, and for the person themselves. With
                relation=asked, the name of the member who asked.
     """

    kind: str
    id: None | str
    name: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        id: None | str
        id = self.id

        name: None | str
        name = self.name


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "id": id,
            "name": name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = d.pop("kind")

        def _parse_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        id = _parse_id(d.pop("id"))


        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        list_activity_objects_result_items_item_created_through = cls(
            kind=kind,
            id=id,
            name=name,
        )


        list_activity_objects_result_items_item_created_through.additional_properties = d
        return list_activity_objects_result_items_item_created_through

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
