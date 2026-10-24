from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.grant_forbidden_details import GrantForbiddenDetails
  from ..models.permission_check_resource import PermissionCheckResource





T = TypeVar("T", bound="PermissionCheck")



@_attrs_define
class PermissionCheck:
    """ The decision `GET /whoami?check=<permission>` reports. Nothing is enforced by asking.

        Attributes:
            permission (str):
            allow (bool):
            reason (str | Unset): Why the permission is not allowed; same values as `grant_forbidden`.
            details (GrantForbiddenDetails | Unset): The `details` of a `403 grant_forbidden`: the permission the
                operation needed and the grant that did not hold it.
            resource (PermissionCheckResource | Unset):
     """

    permission: str
    allow: bool
    reason: str | Unset = UNSET
    details: GrantForbiddenDetails | Unset = UNSET
    resource: PermissionCheckResource | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.grant_forbidden_details import GrantForbiddenDetails # noqa: PLC0415
        from ..models.permission_check_resource import PermissionCheckResource # noqa: PLC0415
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
        from ..models.grant_forbidden_details import GrantForbiddenDetails # noqa: PLC0415
        from ..models.permission_check_resource import PermissionCheckResource # noqa: PLC0415
        d = dict(src_dict)
        permission = d.pop("permission")

        allow = d.pop("allow")

        reason = d.pop("reason", UNSET)

        _details = d.pop("details", UNSET)
        details: GrantForbiddenDetails | Unset
        if isinstance(_details,  Unset):
            details = UNSET
        else:
            details = GrantForbiddenDetails.from_dict(_details)




        _resource = d.pop("resource", UNSET)
        resource: PermissionCheckResource | Unset
        if isinstance(_resource,  Unset):
            resource = UNSET
        else:
            resource = PermissionCheckResource.from_dict(_resource)




        permission_check = cls(
            permission=permission,
            allow=allow,
            reason=reason,
            details=details,
            resource=resource,
        )


        permission_check.additional_properties = d
        return permission_check

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
