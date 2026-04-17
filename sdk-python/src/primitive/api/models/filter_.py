from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.filter_type import FilterType
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="Filter")



@_attrs_define
class Filter:
    """ 
        Attributes:
            id (UUID):
            org_id (UUID):
            type_ (FilterType):
            pattern (str): Email address or pattern to match (stored lowercase)
            enabled (bool):
            created_at (datetime.datetime):
            domain_id (None | Unset | UUID): If set, filter applies only to this domain
     """

    id: UUID
    org_id: UUID
    type_: FilterType
    pattern: str
    enabled: bool
    created_at: datetime.datetime
    domain_id: None | Unset | UUID = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        org_id = str(self.org_id)

        type_ = self.type_.value

        pattern = self.pattern

        enabled = self.enabled

        created_at = self.created_at.isoformat()

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "org_id": org_id,
            "type": type_,
            "pattern": pattern,
            "enabled": enabled,
            "created_at": created_at,
        })
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        org_id = UUID(d.pop("org_id"))




        type_ = FilterType(d.pop("type"))




        pattern = d.pop("pattern")

        enabled = d.pop("enabled")

        created_at = isoparse(d.pop("created_at"))




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


        filter_ = cls(
            id=id,
            org_id=org_id,
            type_=type_,
            pattern=pattern,
            enabled=enabled,
            created_at=created_at,
            domain_id=domain_id,
        )


        filter_.additional_properties = d
        return filter_

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
