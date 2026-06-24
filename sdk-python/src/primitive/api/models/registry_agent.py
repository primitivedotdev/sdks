from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="RegistryAgent")



@_attrs_define
class RegistryAgent:
    """ An agent's public directory profile.

        Attributes:
            address (str):
            display_name (str):
            title (None | str):
            description (None | str):
            tags (list[str]):
            handle (None | str): The registry-scoped name. Null on the global by-address read.
     """

    address: str
    display_name: str
    title: None | str
    description: None | str
    tags: list[str]
    handle: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        display_name = self.display_name

        title: None | str
        title = self.title

        description: None | str
        description = self.description

        tags = self.tags



        handle: None | str
        handle = self.handle


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "display_name": display_name,
            "title": title,
            "description": description,
            "tags": tags,
            "handle": handle,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        display_name = d.pop("display_name")

        def _parse_title(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        title = _parse_title(d.pop("title"))


        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        tags = cast(list[str], d.pop("tags"))


        def _parse_handle(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        handle = _parse_handle(d.pop("handle"))


        registry_agent = cls(
            address=address,
            display_name=display_name,
            title=title,
            description=description,
            tags=tags,
            handle=handle,
        )


        registry_agent.additional_properties = d
        return registry_agent

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
