from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="ListAgentConnectionsResponse200Meta")



@_attrs_define
class ListAgentConnectionsResponse200Meta:
    """
        Attributes:
            limit (int): The page size this answer used.
            cursor (None | str): The connection id to pass as cursor for the next page; null on the last page.
     """

    limit: int
    cursor: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        limit = self.limit

        cursor: None | str
        cursor = self.cursor


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "limit": limit,
            "cursor": cursor,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        limit = d.pop("limit")

        def _parse_cursor(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cursor = _parse_cursor(d.pop("cursor"))


        list_agent_connections_response_200_meta = cls(
            limit=limit,
            cursor=cursor,
        )


        list_agent_connections_response_200_meta.additional_properties = d
        return list_agent_connections_response_200_meta

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
