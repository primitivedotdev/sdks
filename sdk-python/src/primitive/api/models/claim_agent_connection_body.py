from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast






T = TypeVar("T", bound="ClaimAgentConnectionBody")



@_attrs_define
class ClaimAgentConnectionBody:
    """
        Attributes:
            token (str):
            capabilities (list[Literal['primitive.presence/1']] | Unset):
     """

    token: str
    capabilities: list[Literal['primitive.presence/1']] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        token = self.token

        capabilities: list[Literal['primitive.presence/1']] | Unset = UNSET
        if not isinstance(self.capabilities, Unset):
            capabilities = self.capabilities




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "token": token,
        })
        if capabilities is not UNSET:
            field_dict["capabilities"] = capabilities

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        token = d.pop("token")

        _capabilities = d.pop("capabilities", UNSET)
        capabilities: list[Literal['primitive.presence/1']] | Unset = UNSET
        if _capabilities is not UNSET:
            capabilities = []
            for capabilities_item_data in _capabilities:
                capabilities_item = cast(Literal['primitive.presence/1'] , capabilities_item_data)
                if capabilities_item != 'primitive.presence/1':
                    raise ValueError(f"capabilities_item must match const 'primitive.presence/1', got '{capabilities_item}'")
                capabilities.append(capabilities_item)


        claim_agent_connection_body = cls(
            token=token,
            capabilities=capabilities,
        )

        return claim_agent_connection_body
