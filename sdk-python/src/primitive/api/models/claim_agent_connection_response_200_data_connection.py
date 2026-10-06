from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.claim_agent_connection_response_200_data_connection_ownership_kind import ClaimAgentConnectionResponse200DataConnectionOwnershipKind
from ..models.claim_agent_connection_response_200_data_connection_status import ClaimAgentConnectionResponse200DataConnectionStatus
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.agent_presence_type_0 import AgentPresenceType0





T = TypeVar("T", bound="ClaimAgentConnectionResponse200DataConnection")



@_attrs_define
class ClaimAgentConnectionResponse200DataConnection:
    """
        Attributes:
            address (str):
            name (str):
            owner_address (str):
            status (ClaimAgentConnectionResponse200DataConnectionStatus):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            claimed_at (datetime.datetime | None):
            verified_at (datetime.datetime | None):
            last_seen_at (datetime.datetime | None):
            ownership_kind (ClaimAgentConnectionResponse200DataConnectionOwnershipKind):
            owner_user_id (None | str):
            owner_active (bool | None):
            presence (AgentPresenceType0 | None | Unset):
     """

    address: str
    name: str
    owner_address: str
    status: ClaimAgentConnectionResponse200DataConnectionStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime
    claimed_at: datetime.datetime | None
    verified_at: datetime.datetime | None
    last_seen_at: datetime.datetime | None
    ownership_kind: ClaimAgentConnectionResponse200DataConnectionOwnershipKind
    owner_user_id: None | str
    owner_active: bool | None
    presence: AgentPresenceType0 | None | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_presence_type_0 import AgentPresenceType0 # noqa: PLC0415
        address = self.address

        name = self.name

        owner_address = self.owner_address

        status = self.status.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        claimed_at: None | str
        if isinstance(self.claimed_at, datetime.datetime):
            claimed_at = self.claimed_at.isoformat()
        else:
            claimed_at = self.claimed_at

        verified_at: None | str
        if isinstance(self.verified_at, datetime.datetime):
            verified_at = self.verified_at.isoformat()
        else:
            verified_at = self.verified_at

        last_seen_at: None | str
        if isinstance(self.last_seen_at, datetime.datetime):
            last_seen_at = self.last_seen_at.isoformat()
        else:
            last_seen_at = self.last_seen_at

        ownership_kind = self.ownership_kind.value

        owner_user_id: None | str
        owner_user_id = self.owner_user_id

        owner_active: bool | None
        owner_active = self.owner_active

        presence: dict[str, Any] | None | Unset
        if isinstance(self.presence, Unset):
            presence = UNSET
        elif isinstance(self.presence, AgentPresenceType0):
            presence = self.presence.to_dict()
        else:
            presence = self.presence


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "address": address,
            "name": name,
            "owner_address": owner_address,
            "status": status,
            "created_at": created_at,
            "updated_at": updated_at,
            "claimed_at": claimed_at,
            "verified_at": verified_at,
            "last_seen_at": last_seen_at,
            "ownership_kind": ownership_kind,
            "owner_user_id": owner_user_id,
            "owner_active": owner_active,
        })
        if presence is not UNSET:
            field_dict["presence"] = presence

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_presence_type_0 import AgentPresenceType0 # noqa: PLC0415
        d = dict(src_dict)
        address = d.pop("address")

        name = d.pop("name")

        owner_address = d.pop("owner_address")

        status = ClaimAgentConnectionResponse200DataConnectionStatus(d.pop("status"))




        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        def _parse_claimed_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                claimed_at_type_0 = datetime.datetime.fromisoformat(data)



                return claimed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        claimed_at = _parse_claimed_at(d.pop("claimed_at"))


        def _parse_verified_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                verified_at_type_0 = datetime.datetime.fromisoformat(data)



                return verified_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        verified_at = _parse_verified_at(d.pop("verified_at"))


        def _parse_last_seen_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_seen_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_seen_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_seen_at = _parse_last_seen_at(d.pop("last_seen_at"))


        ownership_kind = ClaimAgentConnectionResponse200DataConnectionOwnershipKind(d.pop("ownership_kind"))




        def _parse_owner_user_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        owner_user_id = _parse_owner_user_id(d.pop("owner_user_id"))


        def _parse_owner_active(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        owner_active = _parse_owner_active(d.pop("owner_active"))


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


        claim_agent_connection_response_200_data_connection = cls(
            address=address,
            name=name,
            owner_address=owner_address,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
            claimed_at=claimed_at,
            verified_at=verified_at,
            last_seen_at=last_seen_at,
            ownership_kind=ownership_kind,
            owner_user_id=owner_user_id,
            owner_active=owner_active,
            presence=presence,
        )

        return claim_agent_connection_response_200_data_connection
