from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_role_request_mail_scope_type_0 import CreateRoleRequestMailScopeType0
from typing import cast

if TYPE_CHECKING:
  from ..models.create_role_request_mail_scope_type_1 import CreateRoleRequestMailScopeType1





T = TypeVar("T", bound="CreateRoleRequest")



@_attrs_define
class CreateRoleRequest:
    """ 
        Attributes:
            name (str):
            permissions (list[str]):
            description (None | str | Unset):
            mail_scope (CreateRoleRequestMailScopeType0 | CreateRoleRequestMailScopeType1 | Unset):
     """

    name: str
    permissions: list[str]
    description: None | str | Unset = UNSET
    mail_scope: CreateRoleRequestMailScopeType0 | CreateRoleRequestMailScopeType1 | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_role_request_mail_scope_type_1 import CreateRoleRequestMailScopeType1 # noqa: PLC0415
        name = self.name

        permissions = self.permissions



        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        mail_scope: dict[str, Any] | str | Unset
        if isinstance(self.mail_scope, Unset):
            mail_scope = UNSET
        elif isinstance(self.mail_scope, CreateRoleRequestMailScopeType0):
            mail_scope = self.mail_scope.value
        else:
            mail_scope = self.mail_scope.to_dict()



        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
            "permissions": permissions,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if mail_scope is not UNSET:
            field_dict["mail_scope"] = mail_scope

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_role_request_mail_scope_type_1 import CreateRoleRequestMailScopeType1 # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name")

        permissions = cast(list[str], d.pop("permissions"))


        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        def _parse_mail_scope(data: object) -> CreateRoleRequestMailScopeType0 | CreateRoleRequestMailScopeType1 | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                mail_scope_type_0 = CreateRoleRequestMailScopeType0(data)



                return mail_scope_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            mail_scope_type_1 = CreateRoleRequestMailScopeType1.from_dict(data)



            return mail_scope_type_1

        mail_scope = _parse_mail_scope(d.pop("mail_scope", UNSET))


        create_role_request = cls(
            name=name,
            permissions=permissions,
            description=description,
            mail_scope=mail_scope,
        )

        return create_role_request

