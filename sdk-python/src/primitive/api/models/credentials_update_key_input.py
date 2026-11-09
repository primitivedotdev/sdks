from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_update_key_input_grant_type_0 import CredentialsUpdateKeyInputGrantType0
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.credentials_update_key_input_conditions_type_0 import CredentialsUpdateKeyInputConditionsType0
  from ..models.credentials_update_key_input_grant_type_1 import CredentialsUpdateKeyInputGrantType1





T = TypeVar("T", bound="CredentialsUpdateKeyInput")



@_attrs_define
class CredentialsUpdateKeyInput:
    """ 
        Attributes:
            name (str | Unset):
            expires_at (datetime.datetime | None | Unset):
            grant (CredentialsUpdateKeyInputGrantType0 | CredentialsUpdateKeyInputGrantType1 | Unset):
            expected_grant_ref (str | Unset):
            conditions (CredentialsUpdateKeyInputConditionsType0 | None | Unset):
            suspended (bool | Unset):
     """

    name: str | Unset = UNSET
    expires_at: datetime.datetime | None | Unset = UNSET
    grant: CredentialsUpdateKeyInputGrantType0 | CredentialsUpdateKeyInputGrantType1 | Unset = UNSET
    expected_grant_ref: str | Unset = UNSET
    conditions: CredentialsUpdateKeyInputConditionsType0 | None | Unset = UNSET
    suspended: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_update_key_input_conditions_type_0 import CredentialsUpdateKeyInputConditionsType0 # noqa: PLC0415
        from ..models.credentials_update_key_input_grant_type_1 import CredentialsUpdateKeyInputGrantType1 # noqa: PLC0415
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
        elif isinstance(self.grant, CredentialsUpdateKeyInputGrantType0):
            grant = self.grant.value
        else:
            grant = self.grant.to_dict()


        expected_grant_ref = self.expected_grant_ref

        conditions: dict[str, Any] | None | Unset
        if isinstance(self.conditions, Unset):
            conditions = UNSET
        elif isinstance(self.conditions, CredentialsUpdateKeyInputConditionsType0):
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
        if expected_grant_ref is not UNSET:
            field_dict["expected_grant_ref"] = expected_grant_ref
        if conditions is not UNSET:
            field_dict["conditions"] = conditions
        if suspended is not UNSET:
            field_dict["suspended"] = suspended

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_update_key_input_conditions_type_0 import CredentialsUpdateKeyInputConditionsType0 # noqa: PLC0415
        from ..models.credentials_update_key_input_grant_type_1 import CredentialsUpdateKeyInputGrantType1 # noqa: PLC0415
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


        def _parse_grant(data: object) -> CredentialsUpdateKeyInputGrantType0 | CredentialsUpdateKeyInputGrantType1 | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                grant_type_0 = CredentialsUpdateKeyInputGrantType0(data)



                return grant_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            grant_type_1 = CredentialsUpdateKeyInputGrantType1.from_dict(data)



            return grant_type_1

        grant = _parse_grant(d.pop("grant", UNSET))


        expected_grant_ref = d.pop("expected_grant_ref", UNSET)

        def _parse_conditions(data: object) -> CredentialsUpdateKeyInputConditionsType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                conditions_type_0 = CredentialsUpdateKeyInputConditionsType0.from_dict(data)



                return conditions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CredentialsUpdateKeyInputConditionsType0 | None | Unset, data)

        conditions = _parse_conditions(d.pop("conditions", UNSET))


        suspended = d.pop("suspended", UNSET)

        credentials_update_key_input = cls(
            name=name,
            expires_at=expires_at,
            grant=grant,
            expected_grant_ref=expected_grant_ref,
            conditions=conditions,
            suspended=suspended,
        )

        return credentials_update_key_input

