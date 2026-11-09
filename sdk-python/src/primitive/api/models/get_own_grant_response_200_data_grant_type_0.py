from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_own_grant_response_200_data_grant_type_0_mail_scope_type_0 import GetOwnGrantResponse200DataGrantType0MailScopeType0
from ..models.get_own_grant_response_200_data_grant_type_0_send_scope_type_0 import GetOwnGrantResponse200DataGrantType0SendScopeType0
from typing import cast

if TYPE_CHECKING:
  from ..models.get_own_grant_response_200_data_grant_type_0_mail_scope_type_1 import GetOwnGrantResponse200DataGrantType0MailScopeType1
  from ..models.get_own_grant_response_200_data_grant_type_0_resources_type_0 import GetOwnGrantResponse200DataGrantType0ResourcesType0
  from ..models.get_own_grant_response_200_data_grant_type_0_scoped_permissions import GetOwnGrantResponse200DataGrantType0ScopedPermissions
  from ..models.get_own_grant_response_200_data_grant_type_0_send_scope_type_1 import GetOwnGrantResponse200DataGrantType0SendScopeType1





T = TypeVar("T", bound="GetOwnGrantResponse200DataGrantType0")



@_attrs_define
class GetOwnGrantResponse200DataGrantType0:
    """ 
        Attributes:
            credential_kind (str):
            template (None | str):
            permissions (list[str]):
            mail_scope (GetOwnGrantResponse200DataGrantType0MailScopeType0 |
                GetOwnGrantResponse200DataGrantType0MailScopeType1):
            resources (GetOwnGrantResponse200DataGrantType0ResourcesType0 | None):
            expires_at (None | str):
            send_scope (GetOwnGrantResponse200DataGrantType0SendScopeType0 |
                GetOwnGrantResponse200DataGrantType0SendScopeType1 | Unset):
            scoped_permissions (GetOwnGrantResponse200DataGrantType0ScopedPermissions | Unset):
     """

    credential_kind: str
    template: None | str
    permissions: list[str]
    mail_scope: GetOwnGrantResponse200DataGrantType0MailScopeType0 | GetOwnGrantResponse200DataGrantType0MailScopeType1
    resources: GetOwnGrantResponse200DataGrantType0ResourcesType0 | None
    expires_at: None | str
    send_scope: GetOwnGrantResponse200DataGrantType0SendScopeType0 | GetOwnGrantResponse200DataGrantType0SendScopeType1 | Unset = UNSET
    scoped_permissions: GetOwnGrantResponse200DataGrantType0ScopedPermissions | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_own_grant_response_200_data_grant_type_0_mail_scope_type_1 import GetOwnGrantResponse200DataGrantType0MailScopeType1 # noqa: PLC0415
        from ..models.get_own_grant_response_200_data_grant_type_0_resources_type_0 import GetOwnGrantResponse200DataGrantType0ResourcesType0 # noqa: PLC0415
        from ..models.get_own_grant_response_200_data_grant_type_0_scoped_permissions import GetOwnGrantResponse200DataGrantType0ScopedPermissions # noqa: PLC0415
        from ..models.get_own_grant_response_200_data_grant_type_0_send_scope_type_1 import GetOwnGrantResponse200DataGrantType0SendScopeType1 # noqa: PLC0415
        credential_kind = self.credential_kind

        template: None | str
        template = self.template

        permissions = self.permissions



        mail_scope: dict[str, Any] | str
        if isinstance(self.mail_scope, GetOwnGrantResponse200DataGrantType0MailScopeType0):
            mail_scope = self.mail_scope.value
        else:
            mail_scope = self.mail_scope.to_dict()


        resources: dict[str, Any] | None
        if isinstance(self.resources, GetOwnGrantResponse200DataGrantType0ResourcesType0):
            resources = self.resources.to_dict()
        else:
            resources = self.resources

        expires_at: None | str
        expires_at = self.expires_at

        send_scope: dict[str, Any] | str | Unset
        if isinstance(self.send_scope, Unset):
            send_scope = UNSET
        elif isinstance(self.send_scope, GetOwnGrantResponse200DataGrantType0SendScopeType0):
            send_scope = self.send_scope.value
        else:
            send_scope = self.send_scope.to_dict()


        scoped_permissions: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scoped_permissions, Unset):
            scoped_permissions = self.scoped_permissions.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "credential_kind": credential_kind,
            "template": template,
            "permissions": permissions,
            "mail_scope": mail_scope,
            "resources": resources,
            "expires_at": expires_at,
        })
        if send_scope is not UNSET:
            field_dict["send_scope"] = send_scope
        if scoped_permissions is not UNSET:
            field_dict["scoped_permissions"] = scoped_permissions

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_own_grant_response_200_data_grant_type_0_mail_scope_type_1 import GetOwnGrantResponse200DataGrantType0MailScopeType1 # noqa: PLC0415
        from ..models.get_own_grant_response_200_data_grant_type_0_resources_type_0 import GetOwnGrantResponse200DataGrantType0ResourcesType0 # noqa: PLC0415
        from ..models.get_own_grant_response_200_data_grant_type_0_scoped_permissions import GetOwnGrantResponse200DataGrantType0ScopedPermissions # noqa: PLC0415
        from ..models.get_own_grant_response_200_data_grant_type_0_send_scope_type_1 import GetOwnGrantResponse200DataGrantType0SendScopeType1 # noqa: PLC0415
        d = dict(src_dict)
        credential_kind = d.pop("credential_kind")

        def _parse_template(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        template = _parse_template(d.pop("template"))


        permissions = cast(list[str], d.pop("permissions"))


        def _parse_mail_scope(data: object) -> GetOwnGrantResponse200DataGrantType0MailScopeType0 | GetOwnGrantResponse200DataGrantType0MailScopeType1:
            try:
                if not isinstance(data, str):
                    raise TypeError()
                mail_scope_type_0 = GetOwnGrantResponse200DataGrantType0MailScopeType0(data)



                return mail_scope_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            mail_scope_type_1 = GetOwnGrantResponse200DataGrantType0MailScopeType1.from_dict(data)



            return mail_scope_type_1

        mail_scope = _parse_mail_scope(d.pop("mail_scope"))


        def _parse_resources(data: object) -> GetOwnGrantResponse200DataGrantType0ResourcesType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                resources_type_0 = GetOwnGrantResponse200DataGrantType0ResourcesType0.from_dict(data)



                return resources_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetOwnGrantResponse200DataGrantType0ResourcesType0 | None, data)

        resources = _parse_resources(d.pop("resources"))


        def _parse_expires_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        def _parse_send_scope(data: object) -> GetOwnGrantResponse200DataGrantType0SendScopeType0 | GetOwnGrantResponse200DataGrantType0SendScopeType1 | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                send_scope_type_0 = GetOwnGrantResponse200DataGrantType0SendScopeType0(data)



                return send_scope_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            send_scope_type_1 = GetOwnGrantResponse200DataGrantType0SendScopeType1.from_dict(data)



            return send_scope_type_1

        send_scope = _parse_send_scope(d.pop("send_scope", UNSET))


        _scoped_permissions = d.pop("scoped_permissions", UNSET)
        scoped_permissions: GetOwnGrantResponse200DataGrantType0ScopedPermissions | Unset
        if isinstance(_scoped_permissions,  Unset):
            scoped_permissions = UNSET
        else:
            scoped_permissions = GetOwnGrantResponse200DataGrantType0ScopedPermissions.from_dict(_scoped_permissions)




        get_own_grant_response_200_data_grant_type_0 = cls(
            credential_kind=credential_kind,
            template=template,
            permissions=permissions,
            mail_scope=mail_scope,
            resources=resources,
            expires_at=expires_at,
            send_scope=send_scope,
            scoped_permissions=scoped_permissions,
        )


        get_own_grant_response_200_data_grant_type_0.additional_properties = d
        return get_own_grant_response_200_data_grant_type_0

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
