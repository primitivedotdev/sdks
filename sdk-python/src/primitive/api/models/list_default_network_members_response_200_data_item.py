from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_default_network_members_response_200_data_item_ownership_kind import ListDefaultNetworkMembersResponse200DataItemOwnershipKind
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.list_default_network_members_response_200_data_item_owner_type_0 import ListDefaultNetworkMembersResponse200DataItemOwnerType0
  from ..models.list_default_network_members_response_200_data_item_presence_type_0 import ListDefaultNetworkMembersResponse200DataItemPresenceType0





T = TypeVar("T", bound="ListDefaultNetworkMembersResponse200DataItem")



@_attrs_define
class ListDefaultNetworkMembersResponse200DataItem:
    """
        Attributes:
            address (str):
            name (str):
            can_view (bool):
            is_listed (bool):
            excluded (bool):
            connected (bool):
            can_manage (bool):
            last_seen_at (datetime.datetime | None):
            ownership_kind (ListDefaultNetworkMembersResponse200DataItemOwnershipKind):
            owner (ListDefaultNetworkMembersResponse200DataItemOwnerType0 | None):
            presence (ListDefaultNetworkMembersResponse200DataItemPresenceType0 | None | Unset):
     """

    address: str
    name: str
    can_view: bool
    is_listed: bool
    excluded: bool
    connected: bool
    can_manage: bool
    last_seen_at: datetime.datetime | None
    ownership_kind: ListDefaultNetworkMembersResponse200DataItemOwnershipKind
    owner: ListDefaultNetworkMembersResponse200DataItemOwnerType0 | None
    presence: ListDefaultNetworkMembersResponse200DataItemPresenceType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_default_network_members_response_200_data_item_owner_type_0 import ListDefaultNetworkMembersResponse200DataItemOwnerType0 # noqa: PLC0415
        from ..models.list_default_network_members_response_200_data_item_presence_type_0 import ListDefaultNetworkMembersResponse200DataItemPresenceType0 # noqa: PLC0415
        address = self.address

        name = self.name

        can_view = self.can_view

        is_listed = self.is_listed

        excluded = self.excluded

        connected = self.connected

        can_manage = self.can_manage

        last_seen_at: None | str
        if isinstance(self.last_seen_at, datetime.datetime):
            last_seen_at = self.last_seen_at.isoformat()
        else:
            last_seen_at = self.last_seen_at

        ownership_kind = self.ownership_kind.value

        owner: dict[str, Any] | None
        if isinstance(self.owner, ListDefaultNetworkMembersResponse200DataItemOwnerType0):
            owner = self.owner.to_dict()
        else:
            owner = self.owner

        presence: dict[str, Any] | None | Unset
        if isinstance(self.presence, Unset):
            presence = UNSET
        elif isinstance(self.presence, ListDefaultNetworkMembersResponse200DataItemPresenceType0):
            presence = self.presence.to_dict()
        else:
            presence = self.presence


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "name": name,
            "can_view": can_view,
            "is_listed": is_listed,
            "excluded": excluded,
            "connected": connected,
            "can_manage": can_manage,
            "last_seen_at": last_seen_at,
            "ownership_kind": ownership_kind,
            "owner": owner,
        })
        if presence is not UNSET:
            field_dict["presence"] = presence

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_default_network_members_response_200_data_item_owner_type_0 import ListDefaultNetworkMembersResponse200DataItemOwnerType0 # noqa: PLC0415
        from ..models.list_default_network_members_response_200_data_item_presence_type_0 import ListDefaultNetworkMembersResponse200DataItemPresenceType0 # noqa: PLC0415
        d = dict(src_dict)
        address = d.pop("address")

        name = d.pop("name")

        can_view = d.pop("can_view")

        is_listed = d.pop("is_listed")

        excluded = d.pop("excluded")

        connected = d.pop("connected")

        can_manage = d.pop("can_manage")

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


        ownership_kind = ListDefaultNetworkMembersResponse200DataItemOwnershipKind(d.pop("ownership_kind"))




        def _parse_owner(data: object) -> ListDefaultNetworkMembersResponse200DataItemOwnerType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                owner_type_0 = ListDefaultNetworkMembersResponse200DataItemOwnerType0.from_dict(data)



                return owner_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListDefaultNetworkMembersResponse200DataItemOwnerType0 | None, data)

        owner = _parse_owner(d.pop("owner"))


        def _parse_presence(data: object) -> ListDefaultNetworkMembersResponse200DataItemPresenceType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                presence_type_0 = ListDefaultNetworkMembersResponse200DataItemPresenceType0.from_dict(data)



                return presence_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListDefaultNetworkMembersResponse200DataItemPresenceType0 | None | Unset, data)

        presence = _parse_presence(d.pop("presence", UNSET))


        list_default_network_members_response_200_data_item = cls(
            address=address,
            name=name,
            can_view=can_view,
            is_listed=is_listed,
            excluded=excluded,
            connected=connected,
            can_manage=can_manage,
            last_seen_at=last_seen_at,
            ownership_kind=ownership_kind,
            owner=owner,
            presence=presence,
        )


        list_default_network_members_response_200_data_item.additional_properties = d
        return list_default_network_members_response_200_data_item

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
