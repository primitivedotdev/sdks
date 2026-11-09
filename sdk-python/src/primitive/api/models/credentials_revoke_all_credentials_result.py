from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_revoke_all_credentials_result_org_function_key import CredentialsRevokeAllCredentialsResultOrgFunctionKey
from typing import cast






T = TypeVar("T", bound="CredentialsRevokeAllCredentialsResult")



@_attrs_define
class CredentialsRevokeAllCredentialsResult:
    """ 
        Attributes:
            api_keys_revoked (float):
            connected_keys_revoked (float):
            oauth_grants_revoked (float):
            functions_suspended (float):
            org_function_key (CredentialsRevokeAllCredentialsResultOrgFunctionKey):
            per_function_keys_to_rotate (list[str]):
            cli_logins_revoked (float | Unset):
            per_function_rotation_queued (list[str] | Unset):
     """

    api_keys_revoked: float
    connected_keys_revoked: float
    oauth_grants_revoked: float
    functions_suspended: float
    org_function_key: CredentialsRevokeAllCredentialsResultOrgFunctionKey
    per_function_keys_to_rotate: list[str]
    cli_logins_revoked: float | Unset = UNSET
    per_function_rotation_queued: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        api_keys_revoked = self.api_keys_revoked

        connected_keys_revoked = self.connected_keys_revoked

        oauth_grants_revoked = self.oauth_grants_revoked

        functions_suspended = self.functions_suspended

        org_function_key = self.org_function_key.value

        per_function_keys_to_rotate = self.per_function_keys_to_rotate



        cli_logins_revoked = self.cli_logins_revoked

        per_function_rotation_queued: list[str] | Unset = UNSET
        if not isinstance(self.per_function_rotation_queued, Unset):
            per_function_rotation_queued = self.per_function_rotation_queued




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "api_keys_revoked": api_keys_revoked,
            "connected_keys_revoked": connected_keys_revoked,
            "oauth_grants_revoked": oauth_grants_revoked,
            "functions_suspended": functions_suspended,
            "org_function_key": org_function_key,
            "per_function_keys_to_rotate": per_function_keys_to_rotate,
        })
        if cli_logins_revoked is not UNSET:
            field_dict["cli_logins_revoked"] = cli_logins_revoked
        if per_function_rotation_queued is not UNSET:
            field_dict["per_function_rotation_queued"] = per_function_rotation_queued

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        api_keys_revoked = d.pop("api_keys_revoked")

        connected_keys_revoked = d.pop("connected_keys_revoked")

        oauth_grants_revoked = d.pop("oauth_grants_revoked")

        functions_suspended = d.pop("functions_suspended")

        org_function_key = CredentialsRevokeAllCredentialsResultOrgFunctionKey(d.pop("org_function_key"))




        per_function_keys_to_rotate = cast(list[str], d.pop("per_function_keys_to_rotate"))


        cli_logins_revoked = d.pop("cli_logins_revoked", UNSET)

        per_function_rotation_queued = cast(list[str], d.pop("per_function_rotation_queued", UNSET))


        credentials_revoke_all_credentials_result = cls(
            api_keys_revoked=api_keys_revoked,
            connected_keys_revoked=connected_keys_revoked,
            oauth_grants_revoked=oauth_grants_revoked,
            functions_suspended=functions_suspended,
            org_function_key=org_function_key,
            per_function_keys_to_rotate=per_function_keys_to_rotate,
            cli_logins_revoked=cli_logins_revoked,
            per_function_rotation_queued=per_function_rotation_queued,
        )


        credentials_revoke_all_credentials_result.additional_properties = d
        return credentials_revoke_all_credentials_result

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
