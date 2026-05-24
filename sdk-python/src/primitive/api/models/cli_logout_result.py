from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="CliLogoutResult")



@_attrs_define
class CliLogoutResult:
    """ 
        Attributes:
            revoked (bool): True when an OAuth grant was revoked. False for API-key-authenticated legacy logout, which only
                clears local CLI state.
            key_id (UUID | Unset): API key id for API-key-authenticated legacy logout
            oauth_grant_id (UUID | Unset): OAuth grant id revoked by OAuth-authenticated logout
     """

    revoked: bool
    key_id: UUID | Unset = UNSET
    oauth_grant_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        revoked = self.revoked

        key_id: str | Unset = UNSET
        if not isinstance(self.key_id, Unset):
            key_id = str(self.key_id)

        oauth_grant_id: str | Unset = UNSET
        if not isinstance(self.oauth_grant_id, Unset):
            oauth_grant_id = str(self.oauth_grant_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "revoked": revoked,
        })
        if key_id is not UNSET:
            field_dict["key_id"] = key_id
        if oauth_grant_id is not UNSET:
            field_dict["oauth_grant_id"] = oauth_grant_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        revoked = d.pop("revoked")

        _key_id = d.pop("key_id", UNSET)
        key_id: UUID | Unset
        if isinstance(_key_id,  Unset):
            key_id = UNSET
        else:
            key_id = UUID(_key_id)




        _oauth_grant_id = d.pop("oauth_grant_id", UNSET)
        oauth_grant_id: UUID | Unset
        if isinstance(_oauth_grant_id,  Unset):
            oauth_grant_id = UNSET
        else:
            oauth_grant_id = UUID(_oauth_grant_id)




        cli_logout_result = cls(
            revoked=revoked,
            key_id=key_id,
            oauth_grant_id=oauth_grant_id,
        )


        cli_logout_result.additional_properties = d
        return cli_logout_result

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
