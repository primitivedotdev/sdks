from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.get_own_grant_response_200_data_grant_type_0 import GetOwnGrantResponse200DataGrantType0





T = TypeVar("T", bound="GetOwnGrantResponse200Data")



@_attrs_define
class GetOwnGrantResponse200Data:
    """ 
        Attributes:
            org_id (UUID):
            auth_method (None | str):
            key_id (None | str):
            grant (GetOwnGrantResponse200DataGrantType0 | None):
     """

    org_id: UUID
    auth_method: None | str
    key_id: None | str
    grant: GetOwnGrantResponse200DataGrantType0 | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_own_grant_response_200_data_grant_type_0 import GetOwnGrantResponse200DataGrantType0 # noqa: PLC0415
        org_id = str(self.org_id)

        auth_method: None | str
        auth_method = self.auth_method

        key_id: None | str
        key_id = self.key_id

        grant: dict[str, Any] | None
        if isinstance(self.grant, GetOwnGrantResponse200DataGrantType0):
            grant = self.grant.to_dict()
        else:
            grant = self.grant


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "org_id": org_id,
            "auth_method": auth_method,
            "key_id": key_id,
            "grant": grant,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_own_grant_response_200_data_grant_type_0 import GetOwnGrantResponse200DataGrantType0 # noqa: PLC0415
        d = dict(src_dict)
        org_id = UUID(d.pop("org_id"))




        def _parse_auth_method(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        auth_method = _parse_auth_method(d.pop("auth_method"))


        def _parse_key_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        key_id = _parse_key_id(d.pop("key_id"))


        def _parse_grant(data: object) -> GetOwnGrantResponse200DataGrantType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                grant_type_0 = GetOwnGrantResponse200DataGrantType0.from_dict(data)



                return grant_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetOwnGrantResponse200DataGrantType0 | None, data)

        grant = _parse_grant(d.pop("grant"))


        get_own_grant_response_200_data = cls(
            org_id=org_id,
            auth_method=auth_method,
            key_id=key_id,
            grant=grant,
        )


        get_own_grant_response_200_data.additional_properties = d
        return get_own_grant_response_200_data

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
