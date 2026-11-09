from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.whoami_response_200_data_check_details import WhoamiResponse200DataCheckDetails
  from ..models.whoami_response_200_data_check_resource import WhoamiResponse200DataCheckResource





T = TypeVar("T", bound="WhoamiResponse200DataCheck")



@_attrs_define
class WhoamiResponse200DataCheck:
    """ 
        Attributes:
            permission (str):
            allow (bool):
            reason (str | Unset):
            details (WhoamiResponse200DataCheckDetails | Unset):
            resource (WhoamiResponse200DataCheckResource | Unset):
     """

    permission: str
    allow: bool
    reason: str | Unset = UNSET
    details: WhoamiResponse200DataCheckDetails | Unset = UNSET
    resource: WhoamiResponse200DataCheckResource | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.whoami_response_200_data_check_details import WhoamiResponse200DataCheckDetails # noqa: PLC0415
        from ..models.whoami_response_200_data_check_resource import WhoamiResponse200DataCheckResource # noqa: PLC0415
        permission = self.permission

        allow = self.allow

        reason = self.reason

        details: dict[str, Any] | Unset = UNSET
        if not isinstance(self.details, Unset):
            details = self.details.to_dict()

        resource: dict[str, Any] | Unset = UNSET
        if not isinstance(self.resource, Unset):
            resource = self.resource.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "permission": permission,
            "allow": allow,
        })
        if reason is not UNSET:
            field_dict["reason"] = reason
        if details is not UNSET:
            field_dict["details"] = details
        if resource is not UNSET:
            field_dict["resource"] = resource

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.whoami_response_200_data_check_details import WhoamiResponse200DataCheckDetails # noqa: PLC0415
        from ..models.whoami_response_200_data_check_resource import WhoamiResponse200DataCheckResource # noqa: PLC0415
        d = dict(src_dict)
        permission = d.pop("permission")

        allow = d.pop("allow")

        reason = d.pop("reason", UNSET)

        _details = d.pop("details", UNSET)
        details: WhoamiResponse200DataCheckDetails | Unset
        if isinstance(_details,  Unset):
            details = UNSET
        else:
            details = WhoamiResponse200DataCheckDetails.from_dict(_details)




        _resource = d.pop("resource", UNSET)
        resource: WhoamiResponse200DataCheckResource | Unset
        if isinstance(_resource,  Unset):
            resource = UNSET
        else:
            resource = WhoamiResponse200DataCheckResource.from_dict(_resource)




        whoami_response_200_data_check = cls(
            permission=permission,
            allow=allow,
            reason=reason,
            details=details,
            resource=resource,
        )


        whoami_response_200_data_check.additional_properties = d
        return whoami_response_200_data_check

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
