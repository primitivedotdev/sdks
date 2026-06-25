from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.match_type import MatchType
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="RecipientRoute")



@_attrs_define
class RecipientRoute:
    """ 
        Attributes:
            id (UUID):
            match_type (MatchType | Unset): How a route's pattern is matched against the recipient. exact: the full
                address. wildcard: a glob with * and ? that never crosses the @.
            pattern (str | Unset): The recipient pattern this route matches.
            endpoint_id (UUID | Unset): The endpoint mail matching this route is delivered to.
            domain_id (None | Unset | UUID): Scopes the route to one domain; null applies it org-wide.
            priority (int | Unset): Evaluation order; lower is evaluated first.
            enabled (bool | Unset):
            created_at (datetime.datetime | Unset):
     """

    id: UUID
    match_type: MatchType | Unset = UNSET
    pattern: str | Unset = UNSET
    endpoint_id: UUID | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    priority: int | Unset = UNSET
    enabled: bool | Unset = UNSET
    created_at: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        match_type: str | Unset = UNSET
        if not isinstance(self.match_type, Unset):
            match_type = self.match_type.value


        pattern = self.pattern

        endpoint_id: str | Unset = UNSET
        if not isinstance(self.endpoint_id, Unset):
            endpoint_id = str(self.endpoint_id)

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        priority = self.priority

        enabled = self.enabled

        created_at: str | Unset = UNSET
        if not isinstance(self.created_at, Unset):
            created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
        })
        if match_type is not UNSET:
            field_dict["match_type"] = match_type
        if pattern is not UNSET:
            field_dict["pattern"] = pattern
        if endpoint_id is not UNSET:
            field_dict["endpoint_id"] = endpoint_id
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if priority is not UNSET:
            field_dict["priority"] = priority
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if created_at is not UNSET:
            field_dict["created_at"] = created_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        _match_type = d.pop("match_type", UNSET)
        match_type: MatchType | Unset
        if isinstance(_match_type,  Unset):
            match_type = UNSET
        else:
            match_type = MatchType(_match_type)




        pattern = d.pop("pattern", UNSET)

        _endpoint_id = d.pop("endpoint_id", UNSET)
        endpoint_id: UUID | Unset
        if isinstance(_endpoint_id,  Unset):
            endpoint_id = UNSET
        else:
            endpoint_id = UUID(_endpoint_id)




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


        priority = d.pop("priority", UNSET)

        enabled = d.pop("enabled", UNSET)

        _created_at = d.pop("created_at", UNSET)
        created_at: datetime.datetime | Unset
        if isinstance(_created_at,  Unset):
            created_at = UNSET
        else:
            created_at = isoparse(_created_at)




        recipient_route = cls(
            id=id,
            match_type=match_type,
            pattern=pattern,
            endpoint_id=endpoint_id,
            domain_id=domain_id,
            priority=priority,
            enabled=enabled,
            created_at=created_at,
        )


        recipient_route.additional_properties = d
        return recipient_route

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
