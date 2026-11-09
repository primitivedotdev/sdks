from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_connection_hidden_reason_type_1 import AgentConnectionHiddenReasonType1
from ..models.agent_connection_hidden_reason_type_2_type_1 import AgentConnectionHiddenReasonType2Type1
from ..models.agent_connection_hidden_reason_type_3_type_1 import AgentConnectionHiddenReasonType3Type1
from ..models.agent_connection_ownership_kind import AgentConnectionOwnershipKind
from ..models.agent_connection_status import AgentConnectionStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.agent_connection_presence_type_0 import AgentConnectionPresenceType0





T = TypeVar("T", bound="AgentConnection")



@_attrs_define
class AgentConnection:
    """
        Attributes:
            address (str):
            name (str):
            owner_address (str):
            owner_member_address (None | str):
            status (AgentConnectionStatus):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            claimed_at (datetime.datetime | None):
            verified_at (datetime.datetime | None):
            last_seen_at (datetime.datetime | None):
            ownership_kind (AgentConnectionOwnershipKind):
            owner_user_id (None | UUID):
            owner_active (bool | None):
            id (UUID | Unset):
            shopping_function_id (None | Unset | UUID):
            revoked_at (datetime.datetime | None | Unset):
            presence (AgentConnectionPresenceType0 | None | Unset):
            hidden (bool | Unset):
            hidden_reason (AgentConnectionHiddenReasonType1 | AgentConnectionHiddenReasonType2Type1 |
                AgentConnectionHiddenReasonType3Type1 | None | Unset):
            hidden_at (datetime.datetime | None | Unset):
            keep_visible (bool | Unset):
            last_activity_at (datetime.datetime | None | Unset):
     """

    address: str
    name: str
    owner_address: str
    owner_member_address: None | str
    status: AgentConnectionStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime
    claimed_at: datetime.datetime | None
    verified_at: datetime.datetime | None
    last_seen_at: datetime.datetime | None
    ownership_kind: AgentConnectionOwnershipKind
    owner_user_id: None | UUID
    owner_active: bool | None
    id: UUID | Unset = UNSET
    shopping_function_id: None | Unset | UUID = UNSET
    revoked_at: datetime.datetime | None | Unset = UNSET
    presence: AgentConnectionPresenceType0 | None | Unset = UNSET
    hidden: bool | Unset = UNSET
    hidden_reason: AgentConnectionHiddenReasonType1 | AgentConnectionHiddenReasonType2Type1 | AgentConnectionHiddenReasonType3Type1 | None | Unset = UNSET
    hidden_at: datetime.datetime | None | Unset = UNSET
    keep_visible: bool | Unset = UNSET
    last_activity_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_connection_presence_type_0 import AgentConnectionPresenceType0 # noqa: PLC0415
        address = self.address

        name = self.name

        owner_address = self.owner_address

        owner_member_address: None | str
        owner_member_address = self.owner_member_address

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
        if isinstance(self.owner_user_id, UUID):
            owner_user_id = str(self.owner_user_id)
        else:
            owner_user_id = self.owner_user_id

        owner_active: bool | None
        owner_active = self.owner_active

        id: str | Unset = UNSET
        if not isinstance(self.id, Unset):
            id = str(self.id)

        shopping_function_id: None | str | Unset
        if isinstance(self.shopping_function_id, Unset):
            shopping_function_id = UNSET
        elif isinstance(self.shopping_function_id, UUID):
            shopping_function_id = str(self.shopping_function_id)
        else:
            shopping_function_id = self.shopping_function_id

        revoked_at: None | str | Unset
        if isinstance(self.revoked_at, Unset):
            revoked_at = UNSET
        elif isinstance(self.revoked_at, datetime.datetime):
            revoked_at = self.revoked_at.isoformat()
        else:
            revoked_at = self.revoked_at

        presence: dict[str, Any] | None | Unset
        if isinstance(self.presence, Unset):
            presence = UNSET
        elif isinstance(self.presence, AgentConnectionPresenceType0):
            presence = self.presence.to_dict()
        else:
            presence = self.presence

        hidden = self.hidden

        hidden_reason: None | str | Unset
        if isinstance(self.hidden_reason, Unset):
            hidden_reason = UNSET
        elif isinstance(self.hidden_reason, AgentConnectionHiddenReasonType1):
            hidden_reason = self.hidden_reason.value
        elif isinstance(self.hidden_reason, AgentConnectionHiddenReasonType2Type1):
            hidden_reason = self.hidden_reason.value
        elif isinstance(self.hidden_reason, AgentConnectionHiddenReasonType3Type1):
            hidden_reason = self.hidden_reason.value
        else:
            hidden_reason = self.hidden_reason

        hidden_at: None | str | Unset
        if isinstance(self.hidden_at, Unset):
            hidden_at = UNSET
        elif isinstance(self.hidden_at, datetime.datetime):
            hidden_at = self.hidden_at.isoformat()
        else:
            hidden_at = self.hidden_at

        keep_visible = self.keep_visible

        last_activity_at: None | str | Unset
        if isinstance(self.last_activity_at, Unset):
            last_activity_at = UNSET
        elif isinstance(self.last_activity_at, datetime.datetime):
            last_activity_at = self.last_activity_at.isoformat()
        else:
            last_activity_at = self.last_activity_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "name": name,
            "owner_address": owner_address,
            "owner_member_address": owner_member_address,
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
        if id is not UNSET:
            field_dict["id"] = id
        if shopping_function_id is not UNSET:
            field_dict["shopping_function_id"] = shopping_function_id
        if revoked_at is not UNSET:
            field_dict["revoked_at"] = revoked_at
        if presence is not UNSET:
            field_dict["presence"] = presence
        if hidden is not UNSET:
            field_dict["hidden"] = hidden
        if hidden_reason is not UNSET:
            field_dict["hidden_reason"] = hidden_reason
        if hidden_at is not UNSET:
            field_dict["hidden_at"] = hidden_at
        if keep_visible is not UNSET:
            field_dict["keep_visible"] = keep_visible
        if last_activity_at is not UNSET:
            field_dict["last_activity_at"] = last_activity_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_connection_presence_type_0 import AgentConnectionPresenceType0 # noqa: PLC0415
        d = dict(src_dict)
        address = d.pop("address")

        name = d.pop("name")

        owner_address = d.pop("owner_address")

        def _parse_owner_member_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        owner_member_address = _parse_owner_member_address(d.pop("owner_member_address"))


        status = AgentConnectionStatus(d.pop("status"))




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


        ownership_kind = AgentConnectionOwnershipKind(d.pop("ownership_kind"))




        def _parse_owner_user_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                owner_user_id_type_0 = UUID(data)



                return owner_user_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        owner_user_id = _parse_owner_user_id(d.pop("owner_user_id"))


        def _parse_owner_active(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        owner_active = _parse_owner_active(d.pop("owner_active"))


        _id = d.pop("id", UNSET)
        id: UUID | Unset
        if isinstance(_id,  Unset):
            id = UNSET
        else:
            id = UUID(_id)




        def _parse_shopping_function_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                shopping_function_id_type_0 = UUID(data)



                return shopping_function_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        shopping_function_id = _parse_shopping_function_id(d.pop("shopping_function_id", UNSET))


        def _parse_revoked_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                revoked_at_type_0 = datetime.datetime.fromisoformat(data)



                return revoked_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        revoked_at = _parse_revoked_at(d.pop("revoked_at", UNSET))


        def _parse_presence(data: object) -> AgentConnectionPresenceType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                presence_type_0 = AgentConnectionPresenceType0.from_dict(data)



                return presence_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentConnectionPresenceType0 | None | Unset, data)

        presence = _parse_presence(d.pop("presence", UNSET))


        hidden = d.pop("hidden", UNSET)

        def _parse_hidden_reason(data: object) -> AgentConnectionHiddenReasonType1 | AgentConnectionHiddenReasonType2Type1 | AgentConnectionHiddenReasonType3Type1 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                hidden_reason_type_1 = AgentConnectionHiddenReasonType1(data)



                return hidden_reason_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                hidden_reason_type_2_type_1 = AgentConnectionHiddenReasonType2Type1(data)



                return hidden_reason_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                hidden_reason_type_3_type_1 = AgentConnectionHiddenReasonType3Type1(data)



                return hidden_reason_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentConnectionHiddenReasonType1 | AgentConnectionHiddenReasonType2Type1 | AgentConnectionHiddenReasonType3Type1 | None | Unset, data)

        hidden_reason = _parse_hidden_reason(d.pop("hidden_reason", UNSET))


        def _parse_hidden_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                hidden_at_type_0 = datetime.datetime.fromisoformat(data)



                return hidden_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        hidden_at = _parse_hidden_at(d.pop("hidden_at", UNSET))


        keep_visible = d.pop("keep_visible", UNSET)

        def _parse_last_activity_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_activity_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_activity_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_activity_at = _parse_last_activity_at(d.pop("last_activity_at", UNSET))


        agent_connection = cls(
            address=address,
            name=name,
            owner_address=owner_address,
            owner_member_address=owner_member_address,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
            claimed_at=claimed_at,
            verified_at=verified_at,
            last_seen_at=last_seen_at,
            ownership_kind=ownership_kind,
            owner_user_id=owner_user_id,
            owner_active=owner_active,
            id=id,
            shopping_function_id=shopping_function_id,
            revoked_at=revoked_at,
            presence=presence,
            hidden=hidden,
            hidden_reason=hidden_reason,
            hidden_at=hidden_at,
            keep_visible=keep_visible,
            last_activity_at=last_activity_at,
        )


        agent_connection.additional_properties = d
        return agent_connection

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
