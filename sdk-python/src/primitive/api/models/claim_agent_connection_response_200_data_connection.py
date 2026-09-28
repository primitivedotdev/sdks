from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.claim_agent_connection_response_200_data_connection_status import ClaimAgentConnectionResponse200DataConnectionStatus
from dateutil.parser import isoparse
from typing import cast
import datetime






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





    def to_dict(self) -> dict[str, Any]:
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
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        name = d.pop("name")

        owner_address = d.pop("owner_address")

        status = ClaimAgentConnectionResponse200DataConnectionStatus(d.pop("status"))




        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        def _parse_claimed_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                claimed_at_type_0 = isoparse(data)



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
                verified_at_type_0 = isoparse(data)



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
                last_seen_at_type_0 = isoparse(data)



                return last_seen_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_seen_at = _parse_last_seen_at(d.pop("last_seen_at"))


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
        )

        return claim_agent_connection_response_200_data_connection

