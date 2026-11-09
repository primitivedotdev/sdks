from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.cli_org_access_token_token_type import CliOrgAccessTokenTokenType
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CliOrgAccessToken")



@_attrs_define
class CliOrgAccessToken:
    """ A short-lived access token in one organization, from a CLI user login.

        Attributes:
            access_token (str):
            token_type (CliOrgAccessTokenTokenType):
            expires_in (int):
            org_id (UUID):
            org_name (None | str):
            role (str): Your role's key in the organization, such as a `BuiltinRoleKey` value.
            oauth_grant_id (UUID):
            scope (str | Unset):
     """

    access_token: str
    token_type: CliOrgAccessTokenTokenType
    expires_in: int
    org_id: UUID
    org_name: None | str
    role: str
    oauth_grant_id: UUID
    scope: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        access_token = self.access_token

        token_type = self.token_type.value

        expires_in = self.expires_in

        org_id = str(self.org_id)

        org_name: None | str
        org_name = self.org_name

        role = self.role

        oauth_grant_id = str(self.oauth_grant_id)

        scope = self.scope


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "access_token": access_token,
            "token_type": token_type,
            "expires_in": expires_in,
            "org_id": org_id,
            "org_name": org_name,
            "role": role,
            "oauth_grant_id": oauth_grant_id,
        })
        if scope is not UNSET:
            field_dict["scope"] = scope

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        access_token = d.pop("access_token")

        token_type = CliOrgAccessTokenTokenType(d.pop("token_type"))




        expires_in = d.pop("expires_in")

        org_id = UUID(d.pop("org_id"))




        def _parse_org_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        org_name = _parse_org_name(d.pop("org_name"))


        role = d.pop("role")

        oauth_grant_id = UUID(d.pop("oauth_grant_id"))




        scope = d.pop("scope", UNSET)

        cli_org_access_token = cls(
            access_token=access_token,
            token_type=token_type,
            expires_in=expires_in,
            org_id=org_id,
            org_name=org_name,
            role=role,
            oauth_grant_id=oauth_grant_id,
            scope=scope,
        )


        cli_org_access_token.additional_properties = d
        return cli_org_access_token

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
