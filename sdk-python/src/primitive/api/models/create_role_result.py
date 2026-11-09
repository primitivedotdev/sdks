from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_role_result_kind import CreateRoleResultKind
from typing import cast






T = TypeVar("T", bound="CreateRoleResult")



@_attrs_define
class CreateRoleResult:
    """ 
        Attributes:
            id (str):
            key (str):
            kind (CreateRoleResultKind):
            name (str):
            description (None | str):
            permissions (list[str]):
            mail_scope (Any):
            version (float):
            catalog_version (None | str):
            predates_catalog (bool):
     """

    id: str
    key: str
    kind: CreateRoleResultKind
    name: str
    description: None | str
    permissions: list[str]
    mail_scope: Any
    version: float
    catalog_version: None | str
    predates_catalog: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        key = self.key

        kind = self.kind.value

        name = self.name

        description: None | str
        description = self.description

        permissions = self.permissions



        mail_scope = self.mail_scope

        version = self.version

        catalog_version: None | str
        catalog_version = self.catalog_version

        predates_catalog = self.predates_catalog


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "key": key,
            "kind": kind,
            "name": name,
            "description": description,
            "permissions": permissions,
            "mail_scope": mail_scope,
            "version": version,
            "catalog_version": catalog_version,
            "predates_catalog": predates_catalog,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        key = d.pop("key")

        kind = CreateRoleResultKind(d.pop("kind"))




        name = d.pop("name")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        permissions = cast(list[str], d.pop("permissions"))


        mail_scope = d.pop("mail_scope")

        version = d.pop("version")

        def _parse_catalog_version(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        catalog_version = _parse_catalog_version(d.pop("catalog_version"))


        predates_catalog = d.pop("predates_catalog")

        create_role_result = cls(
            id=id,
            key=key,
            kind=kind,
            name=name,
            description=description,
            permissions=permissions,
            mail_scope=mail_scope,
            version=version,
            catalog_version=catalog_version,
            predates_catalog=predates_catalog,
        )


        create_role_result.additional_properties = d
        return create_role_result

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
