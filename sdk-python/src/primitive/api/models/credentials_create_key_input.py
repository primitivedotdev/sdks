from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_create_key_input_grant_type_0 import CredentialsCreateKeyInputGrantType0
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.credentials_create_key_input_conditions import CredentialsCreateKeyInputConditions
  from ..models.credentials_create_key_input_grant_type_1 import CredentialsCreateKeyInputGrantType1





T = TypeVar("T", bound="CredentialsCreateKeyInput")



@_attrs_define
class CredentialsCreateKeyInput:
    """ 
        Attributes:
            grant (CredentialsCreateKeyInputGrantType0 | CredentialsCreateKeyInputGrantType1):
            name (str | Unset):
            expires_at (datetime.datetime | Unset):
            expires_in_days (int | Unset):
            conditions (CredentialsCreateKeyInputConditions | Unset):
            onboarding (bool | Unset):
     """

    grant: CredentialsCreateKeyInputGrantType0 | CredentialsCreateKeyInputGrantType1
    name: str | Unset = UNSET
    expires_at: datetime.datetime | Unset = UNSET
    expires_in_days: int | Unset = UNSET
    conditions: CredentialsCreateKeyInputConditions | Unset = UNSET
    onboarding: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_create_key_input_conditions import CredentialsCreateKeyInputConditions # noqa: PLC0415
        from ..models.credentials_create_key_input_grant_type_1 import CredentialsCreateKeyInputGrantType1 # noqa: PLC0415
        grant: dict[str, Any] | str
        if isinstance(self.grant, CredentialsCreateKeyInputGrantType0):
            grant = self.grant.value
        else:
            grant = self.grant.to_dict()


        name = self.name

        expires_at: str | Unset = UNSET
        if not isinstance(self.expires_at, Unset):
            expires_at = self.expires_at.isoformat()

        expires_in_days = self.expires_in_days

        conditions: dict[str, Any] | Unset = UNSET
        if not isinstance(self.conditions, Unset):
            conditions = self.conditions.to_dict()

        onboarding = self.onboarding


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "grant": grant,
        })
        if name is not UNSET:
            field_dict["name"] = name
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at
        if expires_in_days is not UNSET:
            field_dict["expires_in_days"] = expires_in_days
        if conditions is not UNSET:
            field_dict["conditions"] = conditions
        if onboarding is not UNSET:
            field_dict["onboarding"] = onboarding

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_create_key_input_conditions import CredentialsCreateKeyInputConditions # noqa: PLC0415
        from ..models.credentials_create_key_input_grant_type_1 import CredentialsCreateKeyInputGrantType1 # noqa: PLC0415
        d = dict(src_dict)
        def _parse_grant(data: object) -> CredentialsCreateKeyInputGrantType0 | CredentialsCreateKeyInputGrantType1:
            try:
                if not isinstance(data, str):
                    raise TypeError()
                grant_type_0 = CredentialsCreateKeyInputGrantType0(data)



                return grant_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            grant_type_1 = CredentialsCreateKeyInputGrantType1.from_dict(data)



            return grant_type_1

        grant = _parse_grant(d.pop("grant"))


        name = d.pop("name", UNSET)

        _expires_at = d.pop("expires_at", UNSET)
        expires_at: datetime.datetime | Unset
        if isinstance(_expires_at,  Unset):
            expires_at = UNSET
        else:
            expires_at = datetime.datetime.fromisoformat(_expires_at)




        expires_in_days = d.pop("expires_in_days", UNSET)

        _conditions = d.pop("conditions", UNSET)
        conditions: CredentialsCreateKeyInputConditions | Unset
        if isinstance(_conditions,  Unset):
            conditions = UNSET
        else:
            conditions = CredentialsCreateKeyInputConditions.from_dict(_conditions)




        onboarding = d.pop("onboarding", UNSET)

        credentials_create_key_input = cls(
            grant=grant,
            name=name,
            expires_at=expires_at,
            expires_in_days=expires_in_days,
            conditions=conditions,
            onboarding=onboarding,
        )

        return credentials_create_key_input

