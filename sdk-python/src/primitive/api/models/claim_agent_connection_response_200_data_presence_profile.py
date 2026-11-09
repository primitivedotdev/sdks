from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.claim_agent_connection_response_200_data_presence_profile_authentication_profile import ClaimAgentConnectionResponse200DataPresenceProfileAuthenticationProfile
from ..models.claim_agent_connection_response_200_data_presence_profile_protocol import ClaimAgentConnectionResponse200DataPresenceProfileProtocol
from ..models.claim_agent_connection_response_200_data_presence_profile_version import ClaimAgentConnectionResponse200DataPresenceProfileVersion






T = TypeVar("T", bound="ClaimAgentConnectionResponse200DataPresenceProfile")



@_attrs_define
class ClaimAgentConnectionResponse200DataPresenceProfile:
    """
        Attributes:
            protocol (ClaimAgentConnectionResponse200DataPresenceProfileProtocol):
            version (ClaimAgentConnectionResponse200DataPresenceProfileVersion):
            authentication_profile (ClaimAgentConnectionResponse200DataPresenceProfileAuthenticationProfile):
            return_address (str):
     """

    protocol: ClaimAgentConnectionResponse200DataPresenceProfileProtocol
    version: ClaimAgentConnectionResponse200DataPresenceProfileVersion
    authentication_profile: ClaimAgentConnectionResponse200DataPresenceProfileAuthenticationProfile
    return_address: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        protocol = self.protocol.value

        version = self.version.value

        authentication_profile = self.authentication_profile.value

        return_address = self.return_address


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "protocol": protocol,
            "version": version,
            "authentication_profile": authentication_profile,
            "return_address": return_address,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        protocol = ClaimAgentConnectionResponse200DataPresenceProfileProtocol(d.pop("protocol"))




        version = ClaimAgentConnectionResponse200DataPresenceProfileVersion(d.pop("version"))




        authentication_profile = ClaimAgentConnectionResponse200DataPresenceProfileAuthenticationProfile(d.pop("authentication_profile"))




        return_address = d.pop("return_address")

        claim_agent_connection_response_200_data_presence_profile = cls(
            protocol=protocol,
            version=version,
            authentication_profile=authentication_profile,
            return_address=return_address,
        )


        claim_agent_connection_response_200_data_presence_profile.additional_properties = d
        return claim_agent_connection_response_200_data_presence_profile

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
