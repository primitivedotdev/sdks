from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.credentials_list_credential_events_result_items_item_details import CredentialsListCredentialEventsResultItemsItemDetails





T = TypeVar("T", bound="CredentialsListCredentialEventsResultItemsItem")



@_attrs_define
class CredentialsListCredentialEventsResultItemsItem:
    """ 
        Attributes:
            id (str):
            occurred_at (datetime.datetime):
            event_type (str):
            credential_kind (None | str):
            credential_id (None | str):
            credential_prefix (None | str):
            actor_kind (None | str):
            actor_id (None | str):
            grant_ref (None | str):
            catalog_version (None | str):
            request_id (None | str):
            details (CredentialsListCredentialEventsResultItemsItemDetails):
     """

    id: str
    occurred_at: datetime.datetime
    event_type: str
    credential_kind: None | str
    credential_id: None | str
    credential_prefix: None | str
    actor_kind: None | str
    actor_id: None | str
    grant_ref: None | str
    catalog_version: None | str
    request_id: None | str
    details: CredentialsListCredentialEventsResultItemsItemDetails
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_list_credential_events_result_items_item_details import CredentialsListCredentialEventsResultItemsItemDetails # noqa: PLC0415
        id = self.id

        occurred_at = self.occurred_at.isoformat()

        event_type = self.event_type

        credential_kind: None | str
        credential_kind = self.credential_kind

        credential_id: None | str
        credential_id = self.credential_id

        credential_prefix: None | str
        credential_prefix = self.credential_prefix

        actor_kind: None | str
        actor_kind = self.actor_kind

        actor_id: None | str
        actor_id = self.actor_id

        grant_ref: None | str
        grant_ref = self.grant_ref

        catalog_version: None | str
        catalog_version = self.catalog_version

        request_id: None | str
        request_id = self.request_id

        details = self.details.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "occurred_at": occurred_at,
            "event_type": event_type,
            "credential_kind": credential_kind,
            "credential_id": credential_id,
            "credential_prefix": credential_prefix,
            "actor_kind": actor_kind,
            "actor_id": actor_id,
            "grant_ref": grant_ref,
            "catalog_version": catalog_version,
            "request_id": request_id,
            "details": details,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_list_credential_events_result_items_item_details import CredentialsListCredentialEventsResultItemsItemDetails # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        occurred_at = datetime.datetime.fromisoformat(d.pop("occurred_at"))




        event_type = d.pop("event_type")

        def _parse_credential_kind(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        credential_kind = _parse_credential_kind(d.pop("credential_kind"))


        def _parse_credential_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        credential_id = _parse_credential_id(d.pop("credential_id"))


        def _parse_credential_prefix(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        credential_prefix = _parse_credential_prefix(d.pop("credential_prefix"))


        def _parse_actor_kind(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        actor_kind = _parse_actor_kind(d.pop("actor_kind"))


        def _parse_actor_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        actor_id = _parse_actor_id(d.pop("actor_id"))


        def _parse_grant_ref(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        grant_ref = _parse_grant_ref(d.pop("grant_ref"))


        def _parse_catalog_version(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        catalog_version = _parse_catalog_version(d.pop("catalog_version"))


        def _parse_request_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        request_id = _parse_request_id(d.pop("request_id"))


        details = CredentialsListCredentialEventsResultItemsItemDetails.from_dict(d.pop("details"))




        credentials_list_credential_events_result_items_item = cls(
            id=id,
            occurred_at=occurred_at,
            event_type=event_type,
            credential_kind=credential_kind,
            credential_id=credential_id,
            credential_prefix=credential_prefix,
            actor_kind=actor_kind,
            actor_id=actor_id,
            grant_ref=grant_ref,
            catalog_version=catalog_version,
            request_id=request_id,
            details=details,
        )


        credentials_list_credential_events_result_items_item.additional_properties = d
        return credentials_list_credential_events_result_items_item

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
