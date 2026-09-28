from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListAgentContactsResponse200DataItem")



@_attrs_define
class ListAgentContactsResponse200DataItem:
    """ 
        Attributes:
            agent_address (str): Bare email address; trim and lowercase, preserving dots and plus tags.
            contact_address (str): Bare email address; trim and lowercase, preserving dots and plus tags.
            purpose (None | str):
            notify (bool):
            notify_since (datetime.datetime | None):
            notification_generation (None | UUID):
            version (UUID): Opaque CAS token. Changes on mutations and cannot be reused after deletion/recreation.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    agent_address: str
    contact_address: str
    purpose: None | str
    notify: bool
    notify_since: datetime.datetime | None
    notification_generation: None | UUID
    version: UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        agent_address = self.agent_address

        contact_address = self.contact_address

        purpose: None | str
        purpose = self.purpose

        notify = self.notify

        notify_since: None | str
        if isinstance(self.notify_since, datetime.datetime):
            notify_since = self.notify_since.isoformat()
        else:
            notify_since = self.notify_since

        notification_generation: None | str
        if isinstance(self.notification_generation, UUID):
            notification_generation = str(self.notification_generation)
        else:
            notification_generation = self.notification_generation

        version = str(self.version)

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "agent_address": agent_address,
            "contact_address": contact_address,
            "purpose": purpose,
            "notify": notify,
            "notify_since": notify_since,
            "notification_generation": notification_generation,
            "version": version,
            "created_at": created_at,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        agent_address = d.pop("agent_address")

        contact_address = d.pop("contact_address")

        def _parse_purpose(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        purpose = _parse_purpose(d.pop("purpose"))


        notify = d.pop("notify")

        def _parse_notify_since(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                notify_since_type_0 = isoparse(data)



                return notify_since_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        notify_since = _parse_notify_since(d.pop("notify_since"))


        def _parse_notification_generation(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                notification_generation_type_0 = UUID(data)



                return notification_generation_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        notification_generation = _parse_notification_generation(d.pop("notification_generation"))


        version = UUID(d.pop("version"))




        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        list_agent_contacts_response_200_data_item = cls(
            agent_address=agent_address,
            contact_address=contact_address,
            purpose=purpose,
            notify=notify,
            notify_since=notify_since,
            notification_generation=notification_generation,
            version=version,
            created_at=created_at,
            updated_at=updated_at,
        )

        return list_agent_contacts_response_200_data_item

