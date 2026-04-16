from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.endpoint_rules import EndpointRules





T = TypeVar("T", bound="Endpoint")



@_attrs_define
class Endpoint:
    """ 
        Attributes:
            id (UUID):
            org_id (UUID):
            enabled (bool):
            rules (EndpointRules): Endpoint-specific filtering rules
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            delivery_count (int): Total webhook deliveries attempted
            success_count (int): Successful deliveries
            failure_count (int): Failed deliveries
            consecutive_fails (int): Current streak of consecutive failures
            url (None | str | Unset):
            domain_id (None | Unset | UUID): Restrict this endpoint to emails from a specific domain
            last_delivery_at (datetime.datetime | None | Unset):
            last_success_at (datetime.datetime | None | Unset):
            last_failure_at (datetime.datetime | None | Unset):
            deactivated_at (datetime.datetime | None | Unset):
     """

    id: UUID
    org_id: UUID
    enabled: bool
    rules: EndpointRules
    created_at: datetime.datetime
    updated_at: datetime.datetime
    delivery_count: int
    success_count: int
    failure_count: int
    consecutive_fails: int
    url: None | str | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    last_delivery_at: datetime.datetime | None | Unset = UNSET
    last_success_at: datetime.datetime | None | Unset = UNSET
    last_failure_at: datetime.datetime | None | Unset = UNSET
    deactivated_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.endpoint_rules import EndpointRules
        id = str(self.id)

        org_id = str(self.org_id)

        enabled = self.enabled

        rules = self.rules.to_dict()

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        delivery_count = self.delivery_count

        success_count = self.success_count

        failure_count = self.failure_count

        consecutive_fails = self.consecutive_fails

        url: None | str | Unset
        if isinstance(self.url, Unset):
            url = UNSET
        else:
            url = self.url

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        last_delivery_at: None | str | Unset
        if isinstance(self.last_delivery_at, Unset):
            last_delivery_at = UNSET
        elif isinstance(self.last_delivery_at, datetime.datetime):
            last_delivery_at = self.last_delivery_at.isoformat()
        else:
            last_delivery_at = self.last_delivery_at

        last_success_at: None | str | Unset
        if isinstance(self.last_success_at, Unset):
            last_success_at = UNSET
        elif isinstance(self.last_success_at, datetime.datetime):
            last_success_at = self.last_success_at.isoformat()
        else:
            last_success_at = self.last_success_at

        last_failure_at: None | str | Unset
        if isinstance(self.last_failure_at, Unset):
            last_failure_at = UNSET
        elif isinstance(self.last_failure_at, datetime.datetime):
            last_failure_at = self.last_failure_at.isoformat()
        else:
            last_failure_at = self.last_failure_at

        deactivated_at: None | str | Unset
        if isinstance(self.deactivated_at, Unset):
            deactivated_at = UNSET
        elif isinstance(self.deactivated_at, datetime.datetime):
            deactivated_at = self.deactivated_at.isoformat()
        else:
            deactivated_at = self.deactivated_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "org_id": org_id,
            "enabled": enabled,
            "rules": rules,
            "created_at": created_at,
            "updated_at": updated_at,
            "delivery_count": delivery_count,
            "success_count": success_count,
            "failure_count": failure_count,
            "consecutive_fails": consecutive_fails,
        })
        if url is not UNSET:
            field_dict["url"] = url
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if last_delivery_at is not UNSET:
            field_dict["last_delivery_at"] = last_delivery_at
        if last_success_at is not UNSET:
            field_dict["last_success_at"] = last_success_at
        if last_failure_at is not UNSET:
            field_dict["last_failure_at"] = last_failure_at
        if deactivated_at is not UNSET:
            field_dict["deactivated_at"] = deactivated_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.endpoint_rules import EndpointRules
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        org_id = UUID(d.pop("org_id"))




        enabled = d.pop("enabled")

        rules = EndpointRules.from_dict(d.pop("rules"))




        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        delivery_count = d.pop("delivery_count")

        success_count = d.pop("success_count")

        failure_count = d.pop("failure_count")

        consecutive_fails = d.pop("consecutive_fails")

        def _parse_url(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        url = _parse_url(d.pop("url", UNSET))


        def _parse_domain_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                domain_id_type_0 = UUID(data)



                return domain_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        domain_id = _parse_domain_id(d.pop("domain_id", UNSET))


        def _parse_last_delivery_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_delivery_at_type_0 = isoparse(data)



                return last_delivery_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_delivery_at = _parse_last_delivery_at(d.pop("last_delivery_at", UNSET))


        def _parse_last_success_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_success_at_type_0 = isoparse(data)



                return last_success_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_success_at = _parse_last_success_at(d.pop("last_success_at", UNSET))


        def _parse_last_failure_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_failure_at_type_0 = isoparse(data)



                return last_failure_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_failure_at = _parse_last_failure_at(d.pop("last_failure_at", UNSET))


        def _parse_deactivated_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                deactivated_at_type_0 = isoparse(data)



                return deactivated_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        deactivated_at = _parse_deactivated_at(d.pop("deactivated_at", UNSET))


        endpoint = cls(
            id=id,
            org_id=org_id,
            enabled=enabled,
            rules=rules,
            created_at=created_at,
            updated_at=updated_at,
            delivery_count=delivery_count,
            success_count=success_count,
            failure_count=failure_count,
            consecutive_fails=consecutive_fails,
            url=url,
            domain_id=domain_id,
            last_delivery_at=last_delivery_at,
            last_success_at=last_success_at,
            last_failure_at=last_failure_at,
            deactivated_at=deactivated_at,
        )


        endpoint.additional_properties = d
        return endpoint

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
