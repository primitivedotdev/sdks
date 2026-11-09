from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="LookupFunctionResult")



@_attrs_define
class LookupFunctionResult:
    """ 
        Attributes:
            id (UUID):
            name (str):
            deploy_status (str):
            deployed_at (datetime.datetime | None):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            tags (list[str]):
            has_code (bool):
     """

    id: UUID
    name: str
    deploy_status: str
    deployed_at: datetime.datetime | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    tags: list[str]
    has_code: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        deploy_status = self.deploy_status

        deployed_at: None | str
        if isinstance(self.deployed_at, datetime.datetime):
            deployed_at = self.deployed_at.isoformat()
        else:
            deployed_at = self.deployed_at

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        tags = self.tags



        has_code = self.has_code


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "deploy_status": deploy_status,
            "deployed_at": deployed_at,
            "created_at": created_at,
            "updated_at": updated_at,
            "tags": tags,
            "has_code": has_code,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        deploy_status = d.pop("deploy_status")

        def _parse_deployed_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                deployed_at_type_0 = datetime.datetime.fromisoformat(data)



                return deployed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        deployed_at = _parse_deployed_at(d.pop("deployed_at"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        tags = cast(list[str], d.pop("tags"))


        has_code = d.pop("has_code")

        lookup_function_result = cls(
            id=id,
            name=name,
            deploy_status=deploy_status,
            deployed_at=deployed_at,
            created_at=created_at,
            updated_at=updated_at,
            tags=tags,
            has_code=has_code,
        )


        lookup_function_result.additional_properties = d
        return lookup_function_result

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
