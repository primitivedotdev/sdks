from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.credential_event_details import CredentialEventDetails





T = TypeVar("T", bound="CredentialEvent")



@_attrs_define
class CredentialEvent:
    """ 
        Attributes:
            id (str):
            occurred_at (datetime.datetime):
            event_type (str): For example `key.created`, `key.revoked` or `cli_access.granted`.
            details (CredentialEventDetails):
            credential_kind (None | str | Unset):
            credential_id (None | str | Unset):
            credential_prefix (None | str | Unset):
            actor_kind (None | str | Unset):
            actor_id (None | str | Unset):
            grant_ref (None | str | Unset):
            catalog_version (None | str | Unset):
            request_id (None | str | Unset):
     """

    id: str
    occurred_at: datetime.datetime
    event_type: str
    details: CredentialEventDetails
    credential_kind: None | str | Unset = UNSET
    credential_id: None | str | Unset = UNSET
    credential_prefix: None | str | Unset = UNSET
    actor_kind: None | str | Unset = UNSET
    actor_id: None | str | Unset = UNSET
    grant_ref: None | str | Unset = UNSET
    catalog_version: None | str | Unset = UNSET
    request_id: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credential_event_details import CredentialEventDetails # noqa: PLC0415
        id = self.id

        occurred_at = self.occurred_at.isoformat()

        event_type = self.event_type

        details = self.details.to_dict()

        credential_kind: None | str | Unset
        if isinstance(self.credential_kind, Unset):
            credential_kind = UNSET
        else:
            credential_kind = self.credential_kind

        credential_id: None | str | Unset
        if isinstance(self.credential_id, Unset):
            credential_id = UNSET
        else:
            credential_id = self.credential_id

        credential_prefix: None | str | Unset
        if isinstance(self.credential_prefix, Unset):
            credential_prefix = UNSET
        else:
            credential_prefix = self.credential_prefix

        actor_kind: None | str | Unset
        if isinstance(self.actor_kind, Unset):
            actor_kind = UNSET
        else:
            actor_kind = self.actor_kind

        actor_id: None | str | Unset
        if isinstance(self.actor_id, Unset):
            actor_id = UNSET
        else:
            actor_id = self.actor_id

        grant_ref: None | str | Unset
        if isinstance(self.grant_ref, Unset):
            grant_ref = UNSET
        else:
            grant_ref = self.grant_ref

        catalog_version: None | str | Unset
        if isinstance(self.catalog_version, Unset):
            catalog_version = UNSET
        else:
            catalog_version = self.catalog_version

        request_id: None | str | Unset
        if isinstance(self.request_id, Unset):
            request_id = UNSET
        else:
            request_id = self.request_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "occurred_at": occurred_at,
            "event_type": event_type,
            "details": details,
        })
        if credential_kind is not UNSET:
            field_dict["credential_kind"] = credential_kind
        if credential_id is not UNSET:
            field_dict["credential_id"] = credential_id
        if credential_prefix is not UNSET:
            field_dict["credential_prefix"] = credential_prefix
        if actor_kind is not UNSET:
            field_dict["actor_kind"] = actor_kind
        if actor_id is not UNSET:
            field_dict["actor_id"] = actor_id
        if grant_ref is not UNSET:
            field_dict["grant_ref"] = grant_ref
        if catalog_version is not UNSET:
            field_dict["catalog_version"] = catalog_version
        if request_id is not UNSET:
            field_dict["request_id"] = request_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credential_event_details import CredentialEventDetails # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        occurred_at = datetime.datetime.fromisoformat(d.pop("occurred_at"))




        event_type = d.pop("event_type")

        details = CredentialEventDetails.from_dict(d.pop("details"))




        def _parse_credential_kind(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        credential_kind = _parse_credential_kind(d.pop("credential_kind", UNSET))


        def _parse_credential_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        credential_id = _parse_credential_id(d.pop("credential_id", UNSET))


        def _parse_credential_prefix(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        credential_prefix = _parse_credential_prefix(d.pop("credential_prefix", UNSET))


        def _parse_actor_kind(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        actor_kind = _parse_actor_kind(d.pop("actor_kind", UNSET))


        def _parse_actor_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        actor_id = _parse_actor_id(d.pop("actor_id", UNSET))


        def _parse_grant_ref(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        grant_ref = _parse_grant_ref(d.pop("grant_ref", UNSET))


        def _parse_catalog_version(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        catalog_version = _parse_catalog_version(d.pop("catalog_version", UNSET))


        def _parse_request_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        request_id = _parse_request_id(d.pop("request_id", UNSET))


        credential_event = cls(
            id=id,
            occurred_at=occurred_at,
            event_type=event_type,
            details=details,
            credential_kind=credential_kind,
            credential_id=credential_id,
            credential_prefix=credential_prefix,
            actor_kind=actor_kind,
            actor_id=actor_id,
            grant_ref=grant_ref,
            catalog_version=catalog_version,
            request_id=request_id,
        )


        credential_event.additional_properties = d
        return credential_event

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
