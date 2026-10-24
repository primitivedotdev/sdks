from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.role_kind import RoleKind
from typing import cast






T = TypeVar("T", bound="Role")



@_attrs_define
class Role:
    """ 
        Attributes:
            id (str):
            key (str): The role's key. A built-in role uses one of the `BuiltinRoleKey`
                values (`owner`, `admin`, `operator` or `member`);
                template and custom roles use their own keys. Other values can
                appear, so read the key as a string.
            kind (RoleKind):
            name (str):
            permissions (list[str]):
            version (int):
            description (None | str | Unset):
            mail_scope (Any | Unset): `org`, or the addresses, domains and depth the role reaches.
            catalog_version (None | str | Unset):
            predates_catalog (bool | Unset):
     """

    id: str
    key: str
    kind: RoleKind
    name: str
    permissions: list[str]
    version: int
    description: None | str | Unset = UNSET
    mail_scope: Any | Unset = UNSET
    catalog_version: None | str | Unset = UNSET
    predates_catalog: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        key = self.key

        kind = self.kind.value

        name = self.name

        permissions = self.permissions



        version = self.version

        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        mail_scope = self.mail_scope

        catalog_version: None | str | Unset
        if isinstance(self.catalog_version, Unset):
            catalog_version = UNSET
        else:
            catalog_version = self.catalog_version

        predates_catalog = self.predates_catalog


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "key": key,
            "kind": kind,
            "name": name,
            "permissions": permissions,
            "version": version,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if mail_scope is not UNSET:
            field_dict["mail_scope"] = mail_scope
        if catalog_version is not UNSET:
            field_dict["catalog_version"] = catalog_version
        if predates_catalog is not UNSET:
            field_dict["predates_catalog"] = predates_catalog

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        key = d.pop("key")

        kind = RoleKind(d.pop("kind"))




        name = d.pop("name")

        permissions = cast(list[str], d.pop("permissions"))


        version = d.pop("version")

        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        mail_scope = d.pop("mail_scope", UNSET)

        def _parse_catalog_version(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        catalog_version = _parse_catalog_version(d.pop("catalog_version", UNSET))


        predates_catalog = d.pop("predates_catalog", UNSET)

        role = cls(
            id=id,
            key=key,
            kind=kind,
            name=name,
            permissions=permissions,
            version=version,
            description=description,
            mail_scope=mail_scope,
            catalog_version=catalog_version,
            predates_catalog=predates_catalog,
        )


        role.additional_properties = d
        return role

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
