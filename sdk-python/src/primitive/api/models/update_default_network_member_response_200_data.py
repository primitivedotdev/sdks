from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_default_network_member_response_200_data_ownership_kind import UpdateDefaultNetworkMemberResponse200DataOwnershipKind
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.update_default_network_member_response_200_data_owner_type_0 import UpdateDefaultNetworkMemberResponse200DataOwnerType0
  from ..models.update_default_network_member_response_200_data_presence_type_0 import UpdateDefaultNetworkMemberResponse200DataPresenceType0





T = TypeVar("T", bound="UpdateDefaultNetworkMemberResponse200Data")



@_attrs_define
class UpdateDefaultNetworkMemberResponse200Data:
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
            ownership_kind (UpdateDefaultNetworkMemberResponse200DataOwnershipKind):
            owner (None | UpdateDefaultNetworkMemberResponse200DataOwnerType0):
            presence (None | Unset | UpdateDefaultNetworkMemberResponse200DataPresenceType0):
     """

    address: str
    name: str
    can_view: bool
    is_listed: bool
    excluded: bool
    connected: bool
    can_manage: bool
    last_seen_at: datetime.datetime | None
    ownership_kind: UpdateDefaultNetworkMemberResponse200DataOwnershipKind
    owner: None | UpdateDefaultNetworkMemberResponse200DataOwnerType0
    presence: None | Unset | UpdateDefaultNetworkMemberResponse200DataPresenceType0 = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_default_network_member_response_200_data_owner_type_0 import UpdateDefaultNetworkMemberResponse200DataOwnerType0 # noqa: PLC0415
        from ..models.update_default_network_member_response_200_data_presence_type_0 import UpdateDefaultNetworkMemberResponse200DataPresenceType0 # noqa: PLC0415
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
        if isinstance(self.owner, UpdateDefaultNetworkMemberResponse200DataOwnerType0):
            owner = self.owner.to_dict()
        else:
            owner = self.owner

        presence: dict[str, Any] | None | Unset
        if isinstance(self.presence, Unset):
            presence = UNSET
        elif isinstance(self.presence, UpdateDefaultNetworkMemberResponse200DataPresenceType0):
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
        from ..models.update_default_network_member_response_200_data_owner_type_0 import UpdateDefaultNetworkMemberResponse200DataOwnerType0 # noqa: PLC0415
        from ..models.update_default_network_member_response_200_data_presence_type_0 import UpdateDefaultNetworkMemberResponse200DataPresenceType0 # noqa: PLC0415
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


        ownership_kind = UpdateDefaultNetworkMemberResponse200DataOwnershipKind(d.pop("ownership_kind"))




        def _parse_owner(data: object) -> None | UpdateDefaultNetworkMemberResponse200DataOwnerType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                owner_type_0 = UpdateDefaultNetworkMemberResponse200DataOwnerType0.from_dict(data)



                return owner_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UpdateDefaultNetworkMemberResponse200DataOwnerType0, data)

        owner = _parse_owner(d.pop("owner"))


        def _parse_presence(data: object) -> None | Unset | UpdateDefaultNetworkMemberResponse200DataPresenceType0:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                presence_type_0 = UpdateDefaultNetworkMemberResponse200DataPresenceType0.from_dict(data)



                return presence_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UpdateDefaultNetworkMemberResponse200DataPresenceType0, data)

        presence = _parse_presence(d.pop("presence", UNSET))


        update_default_network_member_response_200_data = cls(
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


        update_default_network_member_response_200_data.additional_properties = d
        return update_default_network_member_response_200_data

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
