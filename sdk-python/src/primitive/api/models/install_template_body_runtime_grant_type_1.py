from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.install_template_body_runtime_grant_type_1_mail_scope import InstallTemplateBodyRuntimeGrantType1MailScope
from typing import cast






T = TypeVar("T", bound="InstallTemplateBodyRuntimeGrantType1")



@_attrs_define
class InstallTemplateBodyRuntimeGrantType1:
    """ 
        Attributes:
            preset (str):
            addresses (list[str] | Unset):
            permissions (list[str] | Unset):
            mail_scope (InstallTemplateBodyRuntimeGrantType1MailScope | Unset):
     """

    preset: str
    addresses: list[str] | Unset = UNSET
    permissions: list[str] | Unset = UNSET
    mail_scope: InstallTemplateBodyRuntimeGrantType1MailScope | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        preset = self.preset

        addresses: list[str] | Unset = UNSET
        if not isinstance(self.addresses, Unset):
            addresses = self.addresses



        permissions: list[str] | Unset = UNSET
        if not isinstance(self.permissions, Unset):
            permissions = self.permissions



        mail_scope: str | Unset = UNSET
        if not isinstance(self.mail_scope, Unset):
            mail_scope = self.mail_scope.value



        field_dict: dict[str, Any] = {}

        field_dict.update({
            "preset": preset,
        })
        if addresses is not UNSET:
            field_dict["addresses"] = addresses
        if permissions is not UNSET:
            field_dict["permissions"] = permissions
        if mail_scope is not UNSET:
            field_dict["mail_scope"] = mail_scope

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        preset = d.pop("preset")

        addresses = cast(list[str], d.pop("addresses", UNSET))


        permissions = cast(list[str], d.pop("permissions", UNSET))


        _mail_scope = d.pop("mail_scope", UNSET)
        mail_scope: InstallTemplateBodyRuntimeGrantType1MailScope | Unset
        if isinstance(_mail_scope,  Unset):
            mail_scope = UNSET
        else:
            mail_scope = InstallTemplateBodyRuntimeGrantType1MailScope(_mail_scope)




        install_template_body_runtime_grant_type_1 = cls(
            preset=preset,
            addresses=addresses,
            permissions=permissions,
            mail_scope=mail_scope,
        )

        return install_template_body_runtime_grant_type_1

