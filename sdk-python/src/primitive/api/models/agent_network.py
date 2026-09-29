from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="AgentNetwork")



@_attrs_define
class AgentNetwork:
    """ An organization-owned network. The default network cannot be deleted.

        Attributes:
            id (UUID):
            kind (Literal['organization']):
            is_default (bool):
            name (str):
     """

    id: UUID
    kind: Literal['organization']
    is_default: bool
    name: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        kind = self.kind

        is_default = self.is_default

        name = self.name


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "kind": kind,
            "is_default": is_default,
            "name": name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        kind = cast(Literal['organization'] , d.pop("kind"))
        if kind != 'organization':
            raise ValueError(f"kind must match const 'organization', got '{kind}'")

        is_default = d.pop("is_default")

        name = d.pop("name")

        agent_network = cls(
            id=id,
            kind=kind,
            is_default=is_default,
            name=name,
        )


        agent_network.additional_properties = d
        return agent_network

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
