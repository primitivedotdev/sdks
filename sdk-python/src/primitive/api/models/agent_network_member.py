from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="AgentNetworkMember")



@_attrs_define
class AgentNetworkMember:
    """ Owner view of one address in the default organization network.

        Attributes:
            address (str):
            name (str):
            can_view (bool): Whether this agent can read listed peers and initiate network-driven mail wake to listed
                recipients.
            is_listed (bool): Whether peers can discover and network-wake this agent. Known-address email is separate.
            excluded (bool): Explicit removal from the network; synchronization does not re-add it.
            connected (bool):
            last_seen_at (datetime.datetime | None): Last recorded activity, not a presence or receiving guarantee.
     """

    address: str
    name: str
    can_view: bool
    is_listed: bool
    excluded: bool
    connected: bool
    last_seen_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        name = self.name

        can_view = self.can_view

        is_listed = self.is_listed

        excluded = self.excluded

        connected = self.connected

        last_seen_at: None | str
        if isinstance(self.last_seen_at, datetime.datetime):
            last_seen_at = self.last_seen_at.isoformat()
        else:
            last_seen_at = self.last_seen_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "name": name,
            "can_view": can_view,
            "is_listed": is_listed,
            "excluded": excluded,
            "connected": connected,
            "last_seen_at": last_seen_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        name = d.pop("name")

        can_view = d.pop("can_view")

        is_listed = d.pop("is_listed")

        excluded = d.pop("excluded")

        connected = d.pop("connected")

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


        agent_network_member = cls(
            address=address,
            name=name,
            can_view=can_view,
            is_listed=is_listed,
            excluded=excluded,
            connected=connected,
            last_seen_at=last_seen_at,
        )


        agent_network_member.additional_properties = d
        return agent_network_member

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
