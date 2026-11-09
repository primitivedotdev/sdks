from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_own_grant_response_200_data_grant_type_0_scoped_permissions_additional_property_type_0 import GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType0
from typing import cast

if TYPE_CHECKING:
  from ..models.get_own_grant_response_200_data_grant_type_0_scoped_permissions_additional_property_type_1 import GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType1





T = TypeVar("T", bound="GetOwnGrantResponse200DataGrantType0ScopedPermissions")



@_attrs_define
class GetOwnGrantResponse200DataGrantType0ScopedPermissions:
    

    additional_properties: dict[str, GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType0 | GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType1] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_own_grant_response_200_data_grant_type_0_scoped_permissions_additional_property_type_1 import GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType1 # noqa: PLC0415
        
        field_dict: dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            
            if isinstance(prop, GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType0):
                field_dict[prop_name] = prop.value
            else:
                field_dict[prop_name] = prop.to_dict()



        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_own_grant_response_200_data_grant_type_0_scoped_permissions_additional_property_type_1 import GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType1 # noqa: PLC0415
        d = dict(src_dict)
        get_own_grant_response_200_data_grant_type_0_scoped_permissions = cls(
        )


        additional_properties = {}
        for prop_name, prop_dict in d.items():
            def _parse_additional_property(data: object) -> GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType0 | GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType1:
                try:
                    if not isinstance(data, str):
                        raise TypeError()
                    additional_property_type_0 = GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType0(data)



                    return additional_property_type_0
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                if not isinstance(data, dict):
                    raise TypeError()
                additional_property_type_1 = GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType1.from_dict(data)



                return additional_property_type_1

            additional_property = _parse_additional_property(prop_dict)

            additional_properties[prop_name] = additional_property

        get_own_grant_response_200_data_grant_type_0_scoped_permissions.additional_properties = additional_properties
        return get_own_grant_response_200_data_grant_type_0_scoped_permissions

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType0 | GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType1:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType0 | GetOwnGrantResponse200DataGrantType0ScopedPermissionsAdditionalPropertyType1) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
