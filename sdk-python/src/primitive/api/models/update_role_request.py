from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_role_request_mail_scope_type_0 import UpdateRoleRequestMailScopeType0
from typing import cast

if TYPE_CHECKING:
  from ..models.update_role_request_mail_scope_type_1 import UpdateRoleRequestMailScopeType1





T = TypeVar("T", bound="UpdateRoleRequest")



@_attrs_define
class UpdateRoleRequest:
    """ 
        Attributes:
            name (str | Unset):
            description (None | str | Unset):
            permissions (list[str] | Unset):
            mail_scope (Unset | UpdateRoleRequestMailScopeType0 | UpdateRoleRequestMailScopeType1):
     """

    name: str | Unset = UNSET
    description: None | str | Unset = UNSET
    permissions: list[str] | Unset = UNSET
    mail_scope: Unset | UpdateRoleRequestMailScopeType0 | UpdateRoleRequestMailScopeType1 = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_role_request_mail_scope_type_1 import UpdateRoleRequestMailScopeType1 # noqa: PLC0415
        name = self.name

        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        permissions: list[str] | Unset = UNSET
        if not isinstance(self.permissions, Unset):
            permissions = self.permissions



        mail_scope: dict[str, Any] | str | Unset
        if isinstance(self.mail_scope, Unset):
            mail_scope = UNSET
        elif isinstance(self.mail_scope, UpdateRoleRequestMailScopeType0):
            mail_scope = self.mail_scope.value
        else:
            mail_scope = self.mail_scope.to_dict()



        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if permissions is not UNSET:
            field_dict["permissions"] = permissions
        if mail_scope is not UNSET:
            field_dict["mail_scope"] = mail_scope

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_role_request_mail_scope_type_1 import UpdateRoleRequestMailScopeType1 # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        permissions = cast(list[str], d.pop("permissions", UNSET))


        def _parse_mail_scope(data: object) -> Unset | UpdateRoleRequestMailScopeType0 | UpdateRoleRequestMailScopeType1:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                mail_scope_type_0 = UpdateRoleRequestMailScopeType0(data)



                return mail_scope_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            mail_scope_type_1 = UpdateRoleRequestMailScopeType1.from_dict(data)



            return mail_scope_type_1

        mail_scope = _parse_mail_scope(d.pop("mail_scope", UNSET))


        update_role_request = cls(
            name=name,
            description=description,
            permissions=permissions,
            mail_scope=mail_scope,
        )

        return update_role_request

