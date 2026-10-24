from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="GrantDescription")



@_attrs_define
class GrantDescription:
    """ The grant a credential holds, as `GET /whoami?include=grant` reports it.

        Attributes:
            credential_kind (str):
            permissions (list[str]):
            catalog_version (str):
            actor (Any | Unset): Who the credential acts as.
            grant_ref (None | str | Unset):
            grant_type (str | Unset): `template`, `concrete` or `computed`.
            template (None | str | Unset):
            credential_grant_id (None | str | Unset):
            computed_from (Any | Unset): For a computed grant, the role and delegations it was computed from.
            mail_scope (Any | Unset): `org`, or the addresses, domains and depth the grant reaches.
            resources (Any | Unset): Resource ids the grant is narrowed to, or null.
            expires_at (None | str | Unset):
     """

    credential_kind: str
    permissions: list[str]
    catalog_version: str
    actor: Any | Unset = UNSET
    grant_ref: None | str | Unset = UNSET
    grant_type: str | Unset = UNSET
    template: None | str | Unset = UNSET
    credential_grant_id: None | str | Unset = UNSET
    computed_from: Any | Unset = UNSET
    mail_scope: Any | Unset = UNSET
    resources: Any | Unset = UNSET
    expires_at: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        credential_kind = self.credential_kind

        permissions = self.permissions



        catalog_version = self.catalog_version

        actor = self.actor

        grant_ref: None | str | Unset
        if isinstance(self.grant_ref, Unset):
            grant_ref = UNSET
        else:
            grant_ref = self.grant_ref

        grant_type = self.grant_type

        template: None | str | Unset
        if isinstance(self.template, Unset):
            template = UNSET
        else:
            template = self.template

        credential_grant_id: None | str | Unset
        if isinstance(self.credential_grant_id, Unset):
            credential_grant_id = UNSET
        else:
            credential_grant_id = self.credential_grant_id

        computed_from = self.computed_from

        mail_scope = self.mail_scope

        resources = self.resources

        expires_at: None | str | Unset
        if isinstance(self.expires_at, Unset):
            expires_at = UNSET
        else:
            expires_at = self.expires_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "credential_kind": credential_kind,
            "permissions": permissions,
            "catalog_version": catalog_version,
        })
        if actor is not UNSET:
            field_dict["actor"] = actor
        if grant_ref is not UNSET:
            field_dict["grant_ref"] = grant_ref
        if grant_type is not UNSET:
            field_dict["grant_type"] = grant_type
        if template is not UNSET:
            field_dict["template"] = template
        if credential_grant_id is not UNSET:
            field_dict["credential_grant_id"] = credential_grant_id
        if computed_from is not UNSET:
            field_dict["computed_from"] = computed_from
        if mail_scope is not UNSET:
            field_dict["mail_scope"] = mail_scope
        if resources is not UNSET:
            field_dict["resources"] = resources
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        credential_kind = d.pop("credential_kind")

        permissions = cast(list[str], d.pop("permissions"))


        catalog_version = d.pop("catalog_version")

        actor = d.pop("actor", UNSET)

        def _parse_grant_ref(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        grant_ref = _parse_grant_ref(d.pop("grant_ref", UNSET))


        grant_type = d.pop("grant_type", UNSET)

        def _parse_template(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        template = _parse_template(d.pop("template", UNSET))


        def _parse_credential_grant_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        credential_grant_id = _parse_credential_grant_id(d.pop("credential_grant_id", UNSET))


        computed_from = d.pop("computed_from", UNSET)

        mail_scope = d.pop("mail_scope", UNSET)

        resources = d.pop("resources", UNSET)

        def _parse_expires_at(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        expires_at = _parse_expires_at(d.pop("expires_at", UNSET))


        grant_description = cls(
            credential_kind=credential_kind,
            permissions=permissions,
            catalog_version=catalog_version,
            actor=actor,
            grant_ref=grant_ref,
            grant_type=grant_type,
            template=template,
            credential_grant_id=credential_grant_id,
            computed_from=computed_from,
            mail_scope=mail_scope,
            resources=resources,
            expires_at=expires_at,
        )


        grant_description.additional_properties = d
        return grant_description

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
