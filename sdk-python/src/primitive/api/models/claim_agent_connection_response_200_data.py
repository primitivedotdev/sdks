from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.claim_agent_connection_response_200_data_connection import ClaimAgentConnectionResponse200DataConnection
  from ..models.presence_profile import PresenceProfile





T = TypeVar("T", bound="ClaimAgentConnectionResponse200Data")



@_attrs_define
class ClaimAgentConnectionResponse200Data:
    """
        Attributes:
            connection (ClaimAgentConnectionResponse200DataConnection):
            org_id (str):
            owner_address (str):
            api_key (str):
            api_base_url (str):
            presence_profile (PresenceProfile | Unset):
     """

    connection: ClaimAgentConnectionResponse200DataConnection
    org_id: str
    owner_address: str
    api_key: str
    api_base_url: str
    presence_profile: PresenceProfile | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.claim_agent_connection_response_200_data_connection import ClaimAgentConnectionResponse200DataConnection
        from ..models.presence_profile import PresenceProfile
        connection = self.connection.to_dict()

        org_id = self.org_id

        owner_address = self.owner_address

        api_key = self.api_key

        api_base_url = self.api_base_url

        presence_profile: dict[str, Any] | Unset = UNSET
        if not isinstance(self.presence_profile, Unset):
            presence_profile = self.presence_profile.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "connection": connection,
            "org_id": org_id,
            "owner_address": owner_address,
            "api_key": api_key,
            "api_base_url": api_base_url,
        })
        if presence_profile is not UNSET:
            field_dict["presence_profile"] = presence_profile

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.claim_agent_connection_response_200_data_connection import ClaimAgentConnectionResponse200DataConnection
        from ..models.presence_profile import PresenceProfile
        d = dict(src_dict)
        connection = ClaimAgentConnectionResponse200DataConnection.from_dict(d.pop("connection"))




        org_id = d.pop("org_id")

        owner_address = d.pop("owner_address")

        api_key = d.pop("api_key")

        api_base_url = d.pop("api_base_url")

        _presence_profile = d.pop("presence_profile", UNSET)
        presence_profile: PresenceProfile | Unset
        if isinstance(_presence_profile,  Unset):
            presence_profile = UNSET
        else:
            presence_profile = PresenceProfile.from_dict(_presence_profile)




        claim_agent_connection_response_200_data = cls(
            connection=connection,
            org_id=org_id,
            owner_address=owner_address,
            api_key=api_key,
            api_base_url=api_base_url,
            presence_profile=presence_profile,
        )

        return claim_agent_connection_response_200_data
