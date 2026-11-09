from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_revoke_credential_result_kind import CredentialsRevokeCredentialResultKind
from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_revoke_credential_result_kept_item import CredentialsRevokeCredentialResultKeptItem





T = TypeVar("T", bound="CredentialsRevokeCredentialResult")



@_attrs_define
class CredentialsRevokeCredentialResult:
    """ 
        Attributes:
            revoked (float):
            kind (CredentialsRevokeCredentialResultKind):
            id (str):
            kept (list[CredentialsRevokeCredentialResultKeptItem] | Unset):
     """

    revoked: float
    kind: CredentialsRevokeCredentialResultKind
    id: str
    kept: list[CredentialsRevokeCredentialResultKeptItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_revoke_credential_result_kept_item import CredentialsRevokeCredentialResultKeptItem # noqa: PLC0415
        revoked = self.revoked

        kind = self.kind.value

        id = self.id

        kept: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.kept, Unset):
            kept = []
            for kept_item_data in self.kept:
                kept_item = kept_item_data.to_dict()
                kept.append(kept_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "revoked": revoked,
            "kind": kind,
            "id": id,
        })
        if kept is not UNSET:
            field_dict["kept"] = kept

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_revoke_credential_result_kept_item import CredentialsRevokeCredentialResultKeptItem # noqa: PLC0415
        d = dict(src_dict)
        revoked = d.pop("revoked")

        kind = CredentialsRevokeCredentialResultKind(d.pop("kind"))




        id = d.pop("id")

        _kept = d.pop("kept", UNSET)
        kept: list[CredentialsRevokeCredentialResultKeptItem] | Unset = UNSET
        if _kept is not UNSET:
            kept = []
            for kept_item_data in _kept:
                kept_item = CredentialsRevokeCredentialResultKeptItem.from_dict(kept_item_data)



                kept.append(kept_item)


        credentials_revoke_credential_result = cls(
            revoked=revoked,
            kind=kind,
            id=id,
            kept=kept,
        )


        credentials_revoke_credential_result.additional_properties = d
        return credentials_revoke_credential_result

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
