from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credential_kind import CredentialKind






T = TypeVar("T", bound="RevokeCredentialResult")



@_attrs_define
class RevokeCredentialResult:
    """ 
        Attributes:
            revoked (int):
            kind (CredentialKind): `org_key`, `function_key`, `connected_key`, `oauth`,
                `agent_delegate`, or `cli_user_access` (a person's CLI access in the
                organization through a CLI user login, listed only where those
                logins exist).
            id (str):
     """

    revoked: int
    kind: CredentialKind
    id: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        revoked = self.revoked

        kind = self.kind.value

        id = self.id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "revoked": revoked,
            "kind": kind,
            "id": id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        revoked = d.pop("revoked")

        kind = CredentialKind(d.pop("kind"))




        id = d.pop("id")

        revoke_credential_result = cls(
            revoked=revoked,
            kind=kind,
            id=id,
        )


        revoke_credential_result.additional_properties = d
        return revoke_credential_result

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
