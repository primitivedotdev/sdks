from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.recipient_route_match_type import RecipientRouteMatchType
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.update_route_response_200_data_warnings_item import UpdateRouteResponse200DataWarningsItem





T = TypeVar("T", bound="UpdateRouteResponse200Data")



@_attrs_define
class UpdateRouteResponse200Data:
    """ 
        Attributes:
            id (UUID):
            warnings (list[UpdateRouteResponse200DataWarningsItem]): What the route may not do as written.
                endpoint_owner_limited: its endpoint is owned by a key, a third-party app or agent, or a person limited to some
                mail, so it delivers only mail for recipients that owner may receive (for an outbound-only owner, only bounces).
                route_owner_limited: the same for the route's own owner. owner_unchecked: that could not be checked just now.
                Empty when nothing limits it. Check any recipient with POST /v1/routes/simulate.
            org_id (UUID | Unset):
            domain_id (None | Unset | UUID): Domain the route is scoped to; null = org-wide.
            match_type (RecipientRouteMatchType | Unset):
            pattern (str | Unset): The recipient address pattern (an exact address or a wildcard).
            pattern_norm (None | str | Unset): Normalized pattern used for matching.
            endpoint_id (UUID | Unset): The endpoint inbound mail matching this rule is delivered to.
            priority (int | Unset): Evaluation order within a scope; lower is checked first.
            enabled (bool | Unset):
            match_count (str | Unset): How many emails have matched this rule (a bigint, returned as a string).
            last_matched_at (datetime.datetime | None | Unset):
            created_at (datetime.datetime | Unset):
     """

    id: UUID
    warnings: list[UpdateRouteResponse200DataWarningsItem]
    org_id: UUID | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    match_type: RecipientRouteMatchType | Unset = UNSET
    pattern: str | Unset = UNSET
    pattern_norm: None | str | Unset = UNSET
    endpoint_id: UUID | Unset = UNSET
    priority: int | Unset = UNSET
    enabled: bool | Unset = UNSET
    match_count: str | Unset = UNSET
    last_matched_at: datetime.datetime | None | Unset = UNSET
    created_at: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_route_response_200_data_warnings_item import UpdateRouteResponse200DataWarningsItem # noqa: PLC0415
        id = str(self.id)

        warnings = []
        for warnings_item_data in self.warnings:
            warnings_item = warnings_item_data.to_dict()
            warnings.append(warnings_item)



        org_id: str | Unset = UNSET
        if not isinstance(self.org_id, Unset):
            org_id = str(self.org_id)

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        match_type: str | Unset = UNSET
        if not isinstance(self.match_type, Unset):
            match_type = self.match_type.value


        pattern = self.pattern

        pattern_norm: None | str | Unset
        if isinstance(self.pattern_norm, Unset):
            pattern_norm = UNSET
        else:
            pattern_norm = self.pattern_norm

        endpoint_id: str | Unset = UNSET
        if not isinstance(self.endpoint_id, Unset):
            endpoint_id = str(self.endpoint_id)

        priority = self.priority

        enabled = self.enabled

        match_count = self.match_count

        last_matched_at: None | str | Unset
        if isinstance(self.last_matched_at, Unset):
            last_matched_at = UNSET
        elif isinstance(self.last_matched_at, datetime.datetime):
            last_matched_at = self.last_matched_at.isoformat()
        else:
            last_matched_at = self.last_matched_at

        created_at: str | Unset = UNSET
        if not isinstance(self.created_at, Unset):
            created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "warnings": warnings,
        })
        if org_id is not UNSET:
            field_dict["org_id"] = org_id
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if match_type is not UNSET:
            field_dict["match_type"] = match_type
        if pattern is not UNSET:
            field_dict["pattern"] = pattern
        if pattern_norm is not UNSET:
            field_dict["pattern_norm"] = pattern_norm
        if endpoint_id is not UNSET:
            field_dict["endpoint_id"] = endpoint_id
        if priority is not UNSET:
            field_dict["priority"] = priority
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if match_count is not UNSET:
            field_dict["match_count"] = match_count
        if last_matched_at is not UNSET:
            field_dict["last_matched_at"] = last_matched_at
        if created_at is not UNSET:
            field_dict["created_at"] = created_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_route_response_200_data_warnings_item import UpdateRouteResponse200DataWarningsItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        warnings = []
        _warnings = d.pop("warnings")
        for warnings_item_data in (_warnings):
            warnings_item = UpdateRouteResponse200DataWarningsItem.from_dict(warnings_item_data)



            warnings.append(warnings_item)


        _org_id = d.pop("org_id", UNSET)
        org_id: UUID | Unset
        if isinstance(_org_id,  Unset):
            org_id = UNSET
        else:
            org_id = UUID(_org_id)




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


        _match_type = d.pop("match_type", UNSET)
        match_type: RecipientRouteMatchType | Unset
        if isinstance(_match_type,  Unset):
            match_type = UNSET
        else:
            match_type = RecipientRouteMatchType(_match_type)




        pattern = d.pop("pattern", UNSET)

        def _parse_pattern_norm(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        pattern_norm = _parse_pattern_norm(d.pop("pattern_norm", UNSET))


        _endpoint_id = d.pop("endpoint_id", UNSET)
        endpoint_id: UUID | Unset
        if isinstance(_endpoint_id,  Unset):
            endpoint_id = UNSET
        else:
            endpoint_id = UUID(_endpoint_id)




        priority = d.pop("priority", UNSET)

        enabled = d.pop("enabled", UNSET)

        match_count = d.pop("match_count", UNSET)

        def _parse_last_matched_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_matched_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_matched_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_matched_at = _parse_last_matched_at(d.pop("last_matched_at", UNSET))


        _created_at = d.pop("created_at", UNSET)
        created_at: datetime.datetime | Unset
        if isinstance(_created_at,  Unset):
            created_at = UNSET
        else:
            created_at = datetime.datetime.fromisoformat(_created_at)




        update_route_response_200_data = cls(
            id=id,
            warnings=warnings,
            org_id=org_id,
            domain_id=domain_id,
            match_type=match_type,
            pattern=pattern,
            pattern_norm=pattern_norm,
            endpoint_id=endpoint_id,
            priority=priority,
            enabled=enabled,
            match_count=match_count,
            last_matched_at=last_matched_at,
            created_at=created_at,
        )


        update_route_response_200_data.additional_properties = d
        return update_route_response_200_data

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
