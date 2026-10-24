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





T = TypeVar("T", bound="CreateKeyInput")



@_attrs_define
class CreateKeyInput:
    """ 
        Attributes:
            name (str | Unset):
            grant (KeyGrantSpec | KeyPreset | Unset): A preset name, or a grant spec.
            expires_at (datetime.datetime | Unset): When the key stops working. Use this or `expires_in_days`.
            expires_in_days (int | Unset): Days until the key stops working. Use this or `expires_at`.
            conditions (KeyConditionsInput | Unset):
     """

    name: str | Unset = UNSET
    grant: KeyGrantSpec | KeyPreset | Unset = UNSET
    expires_at: datetime.datetime | Unset = UNSET
    expires_in_days: int | Unset = UNSET
    conditions: KeyConditionsInput | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.key_conditions_input import KeyConditionsInput # noqa: PLC0415
        from ..models.key_grant_spec import KeyGrantSpec # noqa: PLC0415
        name = self.name

        grant: dict[str, Any] | str | Unset
        if isinstance(self.grant, Unset):
            grant = UNSET
        elif isinstance(self.grant, KeyPreset):
            grant = self.grant.value
        else:
            grant = self.grant.to_dict()


        expires_at: str | Unset = UNSET
        if not isinstance(self.expires_at, Unset):
            expires_at = self.expires_at.isoformat()

        expires_in_days = self.expires_in_days

        conditions: dict[str, Any] | Unset = UNSET
        if not isinstance(self.conditions, Unset):
            conditions = self.conditions.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if grant is not UNSET:
            field_dict["grant"] = grant
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at
        if expires_in_days is not UNSET:
            field_dict["expires_in_days"] = expires_in_days
        if conditions is not UNSET:
            field_dict["conditions"] = conditions

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.key_conditions_input import KeyConditionsInput # noqa: PLC0415
        from ..models.key_grant_spec import KeyGrantSpec # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

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


        _expires_at = d.pop("expires_at", UNSET)
        expires_at: datetime.datetime | Unset
        if isinstance(_expires_at,  Unset):
            expires_at = UNSET
        else:
            expires_at = datetime.datetime.fromisoformat(_expires_at)




        expires_in_days = d.pop("expires_in_days", UNSET)

        _conditions = d.pop("conditions", UNSET)
        conditions: KeyConditionsInput | Unset
        if isinstance(_conditions,  Unset):
            conditions = UNSET
        else:
            conditions = KeyConditionsInput.from_dict(_conditions)




        create_key_input = cls(
            name=name,
            grant=grant,
            expires_at=expires_at,
            expires_in_days=expires_in_days,
            conditions=conditions,
        )

        return create_key_input

