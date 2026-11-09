from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.claim_agent_connection_body_capabilities_item import ClaimAgentConnectionBodyCapabilitiesItem
from typing import cast






T = TypeVar("T", bound="ClaimAgentConnectionBody")



@_attrs_define
class ClaimAgentConnectionBody:
    """
        Attributes:
            token (str):
            capabilities (list[ClaimAgentConnectionBodyCapabilitiesItem] | Unset):
     """

    token: str
    capabilities: list[ClaimAgentConnectionBodyCapabilitiesItem] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        token = self.token

        capabilities: list[str] | Unset = UNSET
        if not isinstance(self.capabilities, Unset):
            capabilities = []
            for capabilities_item_data in self.capabilities:
                capabilities_item = capabilities_item_data.value
                capabilities.append(capabilities_item)




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
        capabilities: list[ClaimAgentConnectionBodyCapabilitiesItem] | Unset = UNSET
        if _capabilities is not UNSET:
            capabilities = []
            for capabilities_item_data in _capabilities:
                capabilities_item = ClaimAgentConnectionBodyCapabilitiesItem(capabilities_item_data)



                capabilities.append(capabilities_item)


        claim_agent_connection_body = cls(
            token=token,
            capabilities=capabilities,
        )

        return claim_agent_connection_body
