from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_agent_connection_body_ownership_kind import CreateAgentConnectionBodyOwnershipKind






T = TypeVar("T", bound="CreateAgentConnectionBody")



@_attrs_define
class CreateAgentConnectionBody:
    """
        Attributes:
            name (str):
            address (str | Unset):
            owner_address (str | Unset):
            ownership_kind (CreateAgentConnectionBodyOwnershipKind | Unset):
     """

    name: str
    address: str | Unset = UNSET
    owner_address: str | Unset = UNSET
    ownership_kind: CreateAgentConnectionBodyOwnershipKind | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        address = self.address

        owner_address = self.owner_address

        ownership_kind: str | Unset = UNSET
        if not isinstance(self.ownership_kind, Unset):
            ownership_kind = self.ownership_kind.value



        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
        })
        if address is not UNSET:
            field_dict["address"] = address
        if owner_address is not UNSET:
            field_dict["owner_address"] = owner_address
        if ownership_kind is not UNSET:
            field_dict["ownership_kind"] = ownership_kind

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        address = d.pop("address", UNSET)

        owner_address = d.pop("owner_address", UNSET)

        _ownership_kind = d.pop("ownership_kind", UNSET)
        ownership_kind: CreateAgentConnectionBodyOwnershipKind | Unset
        if isinstance(_ownership_kind,  Unset):
            ownership_kind = UNSET
        else:
            ownership_kind = CreateAgentConnectionBodyOwnershipKind(_ownership_kind)




        create_agent_connection_body = cls(
            name=name,
            address=address,
            owner_address=owner_address,
            ownership_kind=ownership_kind,
        )

        return create_agent_connection_body
