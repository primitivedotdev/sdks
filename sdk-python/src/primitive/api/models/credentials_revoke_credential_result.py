from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_revoke_credential_result_kind import CredentialsRevokeCredentialResultKind
from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_revoke_credential_result_keep_failed_item import CredentialsRevokeCredentialResultKeepFailedItem
  from ..models.credentials_revoke_credential_result_kept_item import CredentialsRevokeCredentialResultKeptItem
  from ..models.credentials_revoke_credential_result_standing_objects_item import CredentialsRevokeCredentialResultStandingObjectsItem





T = TypeVar("T", bound="CredentialsRevokeCredentialResult")



@_attrs_define
class CredentialsRevokeCredentialResult:
    """ 
        Attributes:
            revoked (float):
            kind (CredentialsRevokeCredentialResultKind):
            id (str):
            kept (list[CredentialsRevokeCredentialResultKeptItem] | Unset):
            already_revoked (bool | Unset): true when the API key was already revoked, so nothing changed and revoked is 0.
                Absent otherwise. GET /v1/keys/{id} says when and by whom, to a caller who may read the key.
            keep_failed (list[CredentialsRevokeCredentialResultKeepFailedItem] | Unset): Items you chose to keep that could
                not be taken over after the revocation. Each stopped with it, unless someone else had taken it over in the
                meantime.
            standing_objects (list[CredentialsRevokeCredentialResultStandingObjectsItem] | Unset): What the credential set
                up or owns, listed for review, and for an API key also what it carries on for the keys it was rotated from.
                Revoking deletes none of it.
     """

    revoked: float
    kind: CredentialsRevokeCredentialResultKind
    id: str
    kept: list[CredentialsRevokeCredentialResultKeptItem] | Unset = UNSET
    already_revoked: bool | Unset = UNSET
    keep_failed: list[CredentialsRevokeCredentialResultKeepFailedItem] | Unset = UNSET
    standing_objects: list[CredentialsRevokeCredentialResultStandingObjectsItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_revoke_credential_result_keep_failed_item import CredentialsRevokeCredentialResultKeepFailedItem # noqa: PLC0415
        from ..models.credentials_revoke_credential_result_kept_item import CredentialsRevokeCredentialResultKeptItem # noqa: PLC0415
        from ..models.credentials_revoke_credential_result_standing_objects_item import CredentialsRevokeCredentialResultStandingObjectsItem # noqa: PLC0415
        revoked = self.revoked

        kind = self.kind.value

        id = self.id

        kept: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.kept, Unset):
            kept = []
            for kept_item_data in self.kept:
                kept_item = kept_item_data.to_dict()
                kept.append(kept_item)



        already_revoked = self.already_revoked

        keep_failed: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.keep_failed, Unset):
            keep_failed = []
            for keep_failed_item_data in self.keep_failed:
                keep_failed_item = keep_failed_item_data.to_dict()
                keep_failed.append(keep_failed_item)



        standing_objects: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.standing_objects, Unset):
            standing_objects = []
            for standing_objects_item_data in self.standing_objects:
                standing_objects_item = standing_objects_item_data.to_dict()
                standing_objects.append(standing_objects_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "revoked": revoked,
            "kind": kind,
            "id": id,
        })
        if kept is not UNSET:
            field_dict["kept"] = kept
        if already_revoked is not UNSET:
            field_dict["already_revoked"] = already_revoked
        if keep_failed is not UNSET:
            field_dict["keep_failed"] = keep_failed
        if standing_objects is not UNSET:
            field_dict["standing_objects"] = standing_objects

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_revoke_credential_result_keep_failed_item import CredentialsRevokeCredentialResultKeepFailedItem # noqa: PLC0415
        from ..models.credentials_revoke_credential_result_kept_item import CredentialsRevokeCredentialResultKeptItem # noqa: PLC0415
        from ..models.credentials_revoke_credential_result_standing_objects_item import CredentialsRevokeCredentialResultStandingObjectsItem # noqa: PLC0415
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


        already_revoked = d.pop("already_revoked", UNSET)

        _keep_failed = d.pop("keep_failed", UNSET)
        keep_failed: list[CredentialsRevokeCredentialResultKeepFailedItem] | Unset = UNSET
        if _keep_failed is not UNSET:
            keep_failed = []
            for keep_failed_item_data in _keep_failed:
                keep_failed_item = CredentialsRevokeCredentialResultKeepFailedItem.from_dict(keep_failed_item_data)



                keep_failed.append(keep_failed_item)


        _standing_objects = d.pop("standing_objects", UNSET)
        standing_objects: list[CredentialsRevokeCredentialResultStandingObjectsItem] | Unset = UNSET
        if _standing_objects is not UNSET:
            standing_objects = []
            for standing_objects_item_data in _standing_objects:
                standing_objects_item = CredentialsRevokeCredentialResultStandingObjectsItem.from_dict(standing_objects_item_data)



                standing_objects.append(standing_objects_item)


        credentials_revoke_credential_result = cls(
            revoked=revoked,
            kind=kind,
            id=id,
            kept=kept,
            already_revoked=already_revoked,
            keep_failed=keep_failed,
            standing_objects=standing_objects,
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
