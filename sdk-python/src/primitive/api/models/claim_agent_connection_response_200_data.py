from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.agent_connection import AgentConnection
  from ..models.claim_agent_connection_response_200_data_presence_profile import ClaimAgentConnectionResponse200DataPresenceProfile





T = TypeVar("T", bound="ClaimAgentConnectionResponse200Data")



@_attrs_define
class ClaimAgentConnectionResponse200Data:
    """
        Attributes:
            connection (AgentConnection):
            org_id (UUID):
            owner_address (str):
            owner_member_address (None | str):
            api_key (str):
            api_base_url (str):
            challenge_marker (str | Unset):
            presence_profile (ClaimAgentConnectionResponse200DataPresenceProfile | Unset):
     """

    connection: AgentConnection
    org_id: UUID
    owner_address: str
    owner_member_address: None | str
    api_key: str
    api_base_url: str
    challenge_marker: str | Unset = UNSET
    presence_profile: ClaimAgentConnectionResponse200DataPresenceProfile | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_connection import AgentConnection # noqa: PLC0415
        from ..models.claim_agent_connection_response_200_data_presence_profile import ClaimAgentConnectionResponse200DataPresenceProfile # noqa: PLC0415
        connection = self.connection.to_dict()

        org_id = str(self.org_id)

        owner_address = self.owner_address

        owner_member_address: None | str
        owner_member_address = self.owner_member_address

        api_key = self.api_key

        api_base_url = self.api_base_url

        challenge_marker = self.challenge_marker

        presence_profile: dict[str, Any] | Unset = UNSET
        if not isinstance(self.presence_profile, Unset):
            presence_profile = self.presence_profile.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "connection": connection,
            "org_id": org_id,
            "owner_address": owner_address,
            "owner_member_address": owner_member_address,
            "api_key": api_key,
            "api_base_url": api_base_url,
        })
        if challenge_marker is not UNSET:
            field_dict["challenge_marker"] = challenge_marker
        if presence_profile is not UNSET:
            field_dict["presence_profile"] = presence_profile

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_connection import AgentConnection # noqa: PLC0415
        from ..models.claim_agent_connection_response_200_data_presence_profile import ClaimAgentConnectionResponse200DataPresenceProfile # noqa: PLC0415
        d = dict(src_dict)
        connection = AgentConnection.from_dict(d.pop("connection"))




        org_id = UUID(d.pop("org_id"))




        owner_address = d.pop("owner_address")

        def _parse_owner_member_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        owner_member_address = _parse_owner_member_address(d.pop("owner_member_address"))


        api_key = d.pop("api_key")

        api_base_url = d.pop("api_base_url")

        challenge_marker = d.pop("challenge_marker", UNSET)

        _presence_profile = d.pop("presence_profile", UNSET)
        presence_profile: ClaimAgentConnectionResponse200DataPresenceProfile | Unset
        if isinstance(_presence_profile,  Unset):
            presence_profile = UNSET
        else:
            presence_profile = ClaimAgentConnectionResponse200DataPresenceProfile.from_dict(_presence_profile)




        claim_agent_connection_response_200_data = cls(
            connection=connection,
            org_id=org_id,
            owner_address=owner_address,
            owner_member_address=owner_member_address,
            api_key=api_key,
            api_base_url=api_base_url,
            challenge_marker=challenge_marker,
            presence_profile=presence_profile,
        )


        claim_agent_connection_response_200_data.additional_properties = d
        return claim_agent_connection_response_200_data

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
