from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credential_row_grant_type import CredentialRowGrantType
from typing import cast






T = TypeVar("T", bound="CredentialRowGrant")



@_attrs_define
class CredentialRowGrant:
    """ 
        Attributes:
            ref (None | str | Unset):
            type_ (CredentialRowGrantType | Unset):
            template (None | str | Unset):
            permissions (list[str] | None | Unset):
            mail_scope (Any | Unset): `org`, or the addresses, domains and depth the grant reaches.
            resources (Any | Unset): Resource ids the grant is narrowed to, or null.
     """

    ref: None | str | Unset = UNSET
    type_: CredentialRowGrantType | Unset = UNSET
    template: None | str | Unset = UNSET
    permissions: list[str] | None | Unset = UNSET
    mail_scope: Any | Unset = UNSET
    resources: Any | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        ref: None | str | Unset
        if isinstance(self.ref, Unset):
            ref = UNSET
        else:
            ref = self.ref

        type_: str | Unset = UNSET
        if not isinstance(self.type_, Unset):
            type_ = self.type_.value


        template: None | str | Unset
        if isinstance(self.template, Unset):
            template = UNSET
        else:
            template = self.template

        permissions: list[str] | None | Unset
        if isinstance(self.permissions, Unset):
            permissions = UNSET
        elif isinstance(self.permissions, list):
            permissions = self.permissions


        else:
            permissions = self.permissions

        mail_scope = self.mail_scope

        resources = self.resources


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if ref is not UNSET:
            field_dict["ref"] = ref
        if type_ is not UNSET:
            field_dict["type"] = type_
        if template is not UNSET:
            field_dict["template"] = template
        if permissions is not UNSET:
            field_dict["permissions"] = permissions
        if mail_scope is not UNSET:
            field_dict["mail_scope"] = mail_scope
        if resources is not UNSET:
            field_dict["resources"] = resources

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_ref(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        ref = _parse_ref(d.pop("ref", UNSET))


        _type_ = d.pop("type", UNSET)
        type_: CredentialRowGrantType | Unset
        if isinstance(_type_,  Unset):
            type_ = UNSET
        else:
            type_ = CredentialRowGrantType(_type_)




        def _parse_template(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        template = _parse_template(d.pop("template", UNSET))


        def _parse_permissions(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                permissions_type_0 = cast(list[str], data)

                return permissions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        permissions = _parse_permissions(d.pop("permissions", UNSET))


        mail_scope = d.pop("mail_scope", UNSET)

        resources = d.pop("resources", UNSET)

        credential_row_grant = cls(
            ref=ref,
            type_=type_,
            template=template,
            permissions=permissions,
            mail_scope=mail_scope,
            resources=resources,
        )


        credential_row_grant.additional_properties = d
        return credential_row_grant

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
