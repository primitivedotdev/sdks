from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.grant_forbidden_details_resource import GrantForbiddenDetailsResource





T = TypeVar("T", bound="GrantForbiddenDetails")



@_attrs_define
class GrantForbiddenDetails:
    """ The `details` of a `403 grant_forbidden`: the permission the
    operation needed and the grant that did not hold it.

        Attributes:
            permission (None | str): The permission the operation requires, for example `mail:send`.
            credential_kind (None | str): The kind of credential that made the request, for example `org_key`.
            catalog_version (None | str): Version of the permission catalog the decision used.
            reason (None | str): Why the grant did not allow the operation: `permission_missing`,
                `required_permission_missing`, `mail_scope_requires_org`,
                `resource_outside_grant`, `credential_expired` or
                `unknown_permission`. New reasons may be added.
            grant_template_key (None | str | Unset): The grant template, when the credential holds one.
            credential_grant_id (None | str | Unset): The concrete grant id, when the credential holds one.
            missing (None | str | Unset): A further permission the operation also requires, when that is the one missing.
            resource (GrantForbiddenDetailsResource | Unset): The resource the decision was about, when it named one.
     """

    permission: None | str
    credential_kind: None | str
    catalog_version: None | str
    reason: None | str
    grant_template_key: None | str | Unset = UNSET
    credential_grant_id: None | str | Unset = UNSET
    missing: None | str | Unset = UNSET
    resource: GrantForbiddenDetailsResource | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.grant_forbidden_details_resource import GrantForbiddenDetailsResource # noqa: PLC0415
        permission: None | str
        permission = self.permission

        credential_kind: None | str
        credential_kind = self.credential_kind

        catalog_version: None | str
        catalog_version = self.catalog_version

        reason: None | str
        reason = self.reason

        grant_template_key: None | str | Unset
        if isinstance(self.grant_template_key, Unset):
            grant_template_key = UNSET
        else:
            grant_template_key = self.grant_template_key

        credential_grant_id: None | str | Unset
        if isinstance(self.credential_grant_id, Unset):
            credential_grant_id = UNSET
        else:
            credential_grant_id = self.credential_grant_id

        missing: None | str | Unset
        if isinstance(self.missing, Unset):
            missing = UNSET
        else:
            missing = self.missing

        resource: dict[str, Any] | Unset = UNSET
        if not isinstance(self.resource, Unset):
            resource = self.resource.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "permission": permission,
            "credential_kind": credential_kind,
            "catalog_version": catalog_version,
            "reason": reason,
        })
        if grant_template_key is not UNSET:
            field_dict["grant_template_key"] = grant_template_key
        if credential_grant_id is not UNSET:
            field_dict["credential_grant_id"] = credential_grant_id
        if missing is not UNSET:
            field_dict["missing"] = missing
        if resource is not UNSET:
            field_dict["resource"] = resource

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.grant_forbidden_details_resource import GrantForbiddenDetailsResource # noqa: PLC0415
        d = dict(src_dict)
        def _parse_permission(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        permission = _parse_permission(d.pop("permission"))


        def _parse_credential_kind(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        credential_kind = _parse_credential_kind(d.pop("credential_kind"))


        def _parse_catalog_version(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        catalog_version = _parse_catalog_version(d.pop("catalog_version"))


        def _parse_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        reason = _parse_reason(d.pop("reason"))


        def _parse_grant_template_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        grant_template_key = _parse_grant_template_key(d.pop("grant_template_key", UNSET))


        def _parse_credential_grant_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        credential_grant_id = _parse_credential_grant_id(d.pop("credential_grant_id", UNSET))


        def _parse_missing(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        missing = _parse_missing(d.pop("missing", UNSET))


        _resource = d.pop("resource", UNSET)
        resource: GrantForbiddenDetailsResource | Unset
        if isinstance(_resource,  Unset):
            resource = UNSET
        else:
            resource = GrantForbiddenDetailsResource.from_dict(_resource)




        grant_forbidden_details = cls(
            permission=permission,
            credential_kind=credential_kind,
            catalog_version=catalog_version,
            reason=reason,
            grant_template_key=grant_template_key,
            credential_grant_id=credential_grant_id,
            missing=missing,
            resource=resource,
        )


        grant_forbidden_details.additional_properties = d
        return grant_forbidden_details

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
