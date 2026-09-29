from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_network_peer_ownership_kind import AgentNetworkPeerOwnershipKind
from dateutil.parser import isoparse
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.agent_network_peer_owner_type_0 import AgentNetworkPeerOwnerType0
  from ..models.agent_presence_type_0 import AgentPresenceType0





T = TypeVar("T", bound="AgentNetworkPeer")



@_attrs_define
class AgentNetworkPeer:
    """ Listed peer profile. The email address is the identity.

        Attributes:
            address (str):
            name (str):
            last_seen_at (datetime.datetime | None): Last recorded API activity, not a presence or receiving guarantee.
            ownership_kind (AgentNetworkPeerOwnershipKind):
            owner (AgentNetworkPeerOwnerType0 | None):
            presence (AgentPresenceType0 | None | Unset):
     """

    address: str
    name: str
    last_seen_at: datetime.datetime | None
    ownership_kind: AgentNetworkPeerOwnershipKind
    owner: AgentNetworkPeerOwnerType0 | None
    presence: AgentPresenceType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_network_peer_owner_type_0 import AgentNetworkPeerOwnerType0
        from ..models.agent_presence_type_0 import AgentPresenceType0
        address = self.address

        name = self.name

        last_seen_at: None | str
        if isinstance(self.last_seen_at, datetime.datetime):
            last_seen_at = self.last_seen_at.isoformat()
        else:
            last_seen_at = self.last_seen_at

        ownership_kind = self.ownership_kind.value

        owner: dict[str, Any] | None
        if isinstance(self.owner, AgentNetworkPeerOwnerType0):
            owner = self.owner.to_dict()
        else:
            owner = self.owner

        presence: dict[str, Any] | None | Unset
        if isinstance(self.presence, Unset):
            presence = UNSET
        elif isinstance(self.presence, AgentPresenceType0):
            presence = self.presence.to_dict()
        else:
            presence = self.presence


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "name": name,
            "last_seen_at": last_seen_at,
            "ownership_kind": ownership_kind,
            "owner": owner,
        })
        if presence is not UNSET:
            field_dict["presence"] = presence

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_network_peer_owner_type_0 import AgentNetworkPeerOwnerType0
        from ..models.agent_presence_type_0 import AgentPresenceType0
        d = dict(src_dict)
        address = d.pop("address")

        name = d.pop("name")

        def _parse_last_seen_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_seen_at_type_0 = isoparse(data)



                return last_seen_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_seen_at = _parse_last_seen_at(d.pop("last_seen_at"))


        ownership_kind = AgentNetworkPeerOwnershipKind(d.pop("ownership_kind"))




        def _parse_owner(data: object) -> AgentNetworkPeerOwnerType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                owner_type_0 = AgentNetworkPeerOwnerType0.from_dict(data)



                return owner_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentNetworkPeerOwnerType0 | None, data)

        owner = _parse_owner(d.pop("owner"))


        def _parse_presence(data: object) -> AgentPresenceType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_agent_presence_type_0 = AgentPresenceType0.from_dict(data)



                return componentsschemas_agent_presence_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentPresenceType0 | None | Unset, data)

        presence = _parse_presence(d.pop("presence", UNSET))


        agent_network_peer = cls(
            address=address,
            name=name,
            last_seen_at=last_seen_at,
            ownership_kind=ownership_kind,
            owner=owner,
            presence=presence,
        )


        agent_network_peer.additional_properties = d
        return agent_network_peer

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
