from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.key_preset import KeyPreset
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.key_conditions_input import KeyConditionsInput
  from ..models.key_grant_spec import KeyGrantSpec





T = TypeVar("T", bound="UpdateKeyInput")



@_attrs_define
class UpdateKeyInput:
    """ 
        Attributes:
            name (str | Unset):
            expires_at (datetime.datetime | None | Unset):
            grant (KeyGrantSpec | KeyPreset | Unset): A preset name, or a grant spec.
            conditions (KeyConditionsInput | None | Unset):
            suspended (bool | Unset):
     """

    name: str | Unset = UNSET
    expires_at: datetime.datetime | None | Unset = UNSET
    grant: KeyGrantSpec | KeyPreset | Unset = UNSET
    conditions: KeyConditionsInput | None | Unset = UNSET
    suspended: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.key_conditions_input import KeyConditionsInput # noqa: PLC0415
        from ..models.key_grant_spec import KeyGrantSpec # noqa: PLC0415
        name = self.name

        expires_at: None | str | Unset
        if isinstance(self.expires_at, Unset):
            expires_at = UNSET
        elif isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        grant: dict[str, Any] | str | Unset
        if isinstance(self.grant, Unset):
            grant = UNSET
        elif isinstance(self.grant, KeyPreset):
            grant = self.grant.value
        else:
            grant = self.grant.to_dict()


        conditions: dict[str, Any] | None | Unset
        if isinstance(self.conditions, Unset):
            conditions = UNSET
        elif isinstance(self.conditions, KeyConditionsInput):
            conditions = self.conditions.to_dict()
        else:
            conditions = self.conditions

        suspended = self.suspended


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at
        if grant is not UNSET:
            field_dict["grant"] = grant
        if conditions is not UNSET:
            field_dict["conditions"] = conditions
        if suspended is not UNSET:
            field_dict["suspended"] = suspended

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.key_conditions_input import KeyConditionsInput # noqa: PLC0415
        from ..models.key_grant_spec import KeyGrantSpec # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        def _parse_expires_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = datetime.datetime.fromisoformat(data)



                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        expires_at = _parse_expires_at(d.pop("expires_at", UNSET))


        def _parse_grant(data: object) -> KeyGrantSpec | KeyPreset | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                componentsschemas_key_grant_type_0 = KeyPreset(data)



                return componentsschemas_key_grant_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_key_grant_type_1 = KeyGrantSpec.from_dict(data)



            return componentsschemas_key_grant_type_1

        grant = _parse_grant(d.pop("grant", UNSET))


        def _parse_conditions(data: object) -> KeyConditionsInput | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                conditions_type_1 = KeyConditionsInput.from_dict(data)



                return conditions_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(KeyConditionsInput | None | Unset, data)

        conditions = _parse_conditions(d.pop("conditions", UNSET))


        suspended = d.pop("suspended", UNSET)

        update_key_input = cls(
            name=name,
            expires_at=expires_at,
            grant=grant,
            conditions=conditions,
            suspended=suspended,
        )

        return update_key_input

