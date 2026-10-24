from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.created_key_grant import CreatedKeyGrant
  from ..models.key_grant_warning import KeyGrantWarning





T = TypeVar("T", bound="CreatedKey")



@_attrs_define
class CreatedKey:
    """ 
        Attributes:
            id (str):
            name (None | str):
            key (str): The secret. Shown once; store it now.
            key_prefix (str):
            grant (CreatedKeyGrant):
            expires_at (datetime.datetime | None):
            warnings (list[KeyGrantWarning]):
            conditions (Any | Unset): The key's conditions, or null.
     """

    id: str
    name: None | str
    key: str
    key_prefix: str
    grant: CreatedKeyGrant
    expires_at: datetime.datetime | None
    warnings: list[KeyGrantWarning]
    conditions: Any | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.created_key_grant import CreatedKeyGrant # noqa: PLC0415
        from ..models.key_grant_warning import KeyGrantWarning # noqa: PLC0415
        id = self.id

        name: None | str
        name = self.name

        key = self.key

        key_prefix = self.key_prefix

        grant = self.grant.to_dict()

        expires_at: None | str
        if isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        warnings = []
        for warnings_item_data in self.warnings:
            warnings_item = warnings_item_data.to_dict()
            warnings.append(warnings_item)



        conditions = self.conditions


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "key": key,
            "key_prefix": key_prefix,
            "grant": grant,
            "expires_at": expires_at,
            "warnings": warnings,
        })
        if conditions is not UNSET:
            field_dict["conditions"] = conditions

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.created_key_grant import CreatedKeyGrant # noqa: PLC0415
        from ..models.key_grant_warning import KeyGrantWarning # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        key = d.pop("key")

        key_prefix = d.pop("key_prefix")

        grant = CreatedKeyGrant.from_dict(d.pop("grant"))




        def _parse_expires_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = datetime.datetime.fromisoformat(data)



                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        warnings = []
        _warnings = d.pop("warnings")
        for warnings_item_data in (_warnings):
            warnings_item = KeyGrantWarning.from_dict(warnings_item_data)



            warnings.append(warnings_item)


        conditions = d.pop("conditions", UNSET)

        created_key = cls(
            id=id,
            name=name,
            key=key,
            key_prefix=key_prefix,
            grant=grant,
            expires_at=expires_at,
            warnings=warnings,
            conditions=conditions,
        )


        created_key.additional_properties = d
        return created_key

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
