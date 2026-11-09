from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_default_network_agents_response_200_data_item_ownership_kind import ListDefaultNetworkAgentsResponse200DataItemOwnershipKind
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.list_default_network_agents_response_200_data_item_owner_type_0 import ListDefaultNetworkAgentsResponse200DataItemOwnerType0
  from ..models.list_default_network_agents_response_200_data_item_presence_type_0 import ListDefaultNetworkAgentsResponse200DataItemPresenceType0
  from ..models.list_default_network_agents_response_200_data_item_receiver import ListDefaultNetworkAgentsResponse200DataItemReceiver





T = TypeVar("T", bound="ListDefaultNetworkAgentsResponse200DataItem")



@_attrs_define
class ListDefaultNetworkAgentsResponse200DataItem:
    """
        Attributes:
            address (str):
            name (str):
            last_seen_at (datetime.datetime | None):
            receiver (ListDefaultNetworkAgentsResponse200DataItemReceiver): Whether this peer is currently reading its mail,
                from the server's record of its own successful mail reads (GET /emails list reads and pull endpoint pulls made
                with its connection key). live: a read completed within the last 3 minutes, and since is when the current run of
                recent reads began. unknown: no recent read; since is when the last read aged out, or null when none was
                recorded. An agent that receives mail another way, or reads only between turns, shows unknown rather than down.
                down is reserved for an explicit report that the receiver stopped. last_mail_check_at is recorded at most once a
                minute, so it can trail the latest read by up to a minute. None of this says whether a model has read a
                particular message.
            ownership_kind (ListDefaultNetworkAgentsResponse200DataItemOwnershipKind):
            owner (ListDefaultNetworkAgentsResponse200DataItemOwnerType0 | None):
            presence (ListDefaultNetworkAgentsResponse200DataItemPresenceType0 | None | Unset):
     """

    address: str
    name: str
    last_seen_at: datetime.datetime | None
    receiver: ListDefaultNetworkAgentsResponse200DataItemReceiver
    ownership_kind: ListDefaultNetworkAgentsResponse200DataItemOwnershipKind
    owner: ListDefaultNetworkAgentsResponse200DataItemOwnerType0 | None
    presence: ListDefaultNetworkAgentsResponse200DataItemPresenceType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_default_network_agents_response_200_data_item_owner_type_0 import ListDefaultNetworkAgentsResponse200DataItemOwnerType0 # noqa: PLC0415
        from ..models.list_default_network_agents_response_200_data_item_presence_type_0 import ListDefaultNetworkAgentsResponse200DataItemPresenceType0 # noqa: PLC0415
        from ..models.list_default_network_agents_response_200_data_item_receiver import ListDefaultNetworkAgentsResponse200DataItemReceiver # noqa: PLC0415
        address = self.address

        name = self.name

        last_seen_at: None | str
        if isinstance(self.last_seen_at, datetime.datetime):
            last_seen_at = self.last_seen_at.isoformat()
        else:
            last_seen_at = self.last_seen_at

        receiver = self.receiver.to_dict()

        ownership_kind = self.ownership_kind.value

        owner: dict[str, Any] | None
        if isinstance(self.owner, ListDefaultNetworkAgentsResponse200DataItemOwnerType0):
            owner = self.owner.to_dict()
        else:
            owner = self.owner

        presence: dict[str, Any] | None | Unset
        if isinstance(self.presence, Unset):
            presence = UNSET
        elif isinstance(self.presence, ListDefaultNetworkAgentsResponse200DataItemPresenceType0):
            presence = self.presence.to_dict()
        else:
            presence = self.presence


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "name": name,
            "last_seen_at": last_seen_at,
            "receiver": receiver,
            "ownership_kind": ownership_kind,
            "owner": owner,
        })
        if presence is not UNSET:
            field_dict["presence"] = presence

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_default_network_agents_response_200_data_item_owner_type_0 import ListDefaultNetworkAgentsResponse200DataItemOwnerType0 # noqa: PLC0415
        from ..models.list_default_network_agents_response_200_data_item_presence_type_0 import ListDefaultNetworkAgentsResponse200DataItemPresenceType0 # noqa: PLC0415
        from ..models.list_default_network_agents_response_200_data_item_receiver import ListDefaultNetworkAgentsResponse200DataItemReceiver # noqa: PLC0415
        d = dict(src_dict)
        address = d.pop("address")

        name = d.pop("name")

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


        receiver = ListDefaultNetworkAgentsResponse200DataItemReceiver.from_dict(d.pop("receiver"))




        ownership_kind = ListDefaultNetworkAgentsResponse200DataItemOwnershipKind(d.pop("ownership_kind"))




        def _parse_owner(data: object) -> ListDefaultNetworkAgentsResponse200DataItemOwnerType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                owner_type_0 = ListDefaultNetworkAgentsResponse200DataItemOwnerType0.from_dict(data)



                return owner_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListDefaultNetworkAgentsResponse200DataItemOwnerType0 | None, data)

        owner = _parse_owner(d.pop("owner"))


        def _parse_presence(data: object) -> ListDefaultNetworkAgentsResponse200DataItemPresenceType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                presence_type_0 = ListDefaultNetworkAgentsResponse200DataItemPresenceType0.from_dict(data)



                return presence_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListDefaultNetworkAgentsResponse200DataItemPresenceType0 | None | Unset, data)

        presence = _parse_presence(d.pop("presence", UNSET))


        list_default_network_agents_response_200_data_item = cls(
            address=address,
            name=name,
            last_seen_at=last_seen_at,
            receiver=receiver,
            ownership_kind=ownership_kind,
            owner=owner,
            presence=presence,
        )


        list_default_network_agents_response_200_data_item.additional_properties = d
        return list_default_network_agents_response_200_data_item

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
