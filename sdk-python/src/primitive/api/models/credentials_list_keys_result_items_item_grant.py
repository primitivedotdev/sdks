from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CredentialsListKeysResultItemsItemGrant")



@_attrs_define
class CredentialsListKeysResultItemsItemGrant:
    """ 
        Attributes:
            template (None | str):
            permissions (list[str] | None):
            mail_scope (Any):
     """

    template: None | str
    permissions: list[str] | None
    mail_scope: Any
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        template: None | str
        template = self.template

        permissions: list[str] | None
        if isinstance(self.permissions, list):
            permissions = self.permissions


        else:
            permissions = self.permissions

        mail_scope = self.mail_scope


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "template": template,
            "permissions": permissions,
            "mail_scope": mail_scope,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_template(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        template = _parse_template(d.pop("template"))


        def _parse_permissions(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                permissions_type_0 = cast(list[str], data)

                return permissions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        permissions = _parse_permissions(d.pop("permissions"))


        mail_scope = d.pop("mail_scope")

        credentials_list_keys_result_items_item_grant = cls(
            template=template,
            permissions=permissions,
            mail_scope=mail_scope,
        )


        credentials_list_keys_result_items_item_grant.additional_properties = d
        return credentials_list_keys_result_items_item_grant

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
