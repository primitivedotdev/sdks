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
            already_revoked (bool | Unset): true when the API key was already revoked. revoked then counts only the keys it
                replaced that were revoked now. Absent otherwise. GET /v1/keys/{id} says when and by whom, to a caller who may
                read the key.
            keep_failed (list[CredentialsRevokeCredentialResultKeepFailedItem] | Unset): Items you chose to keep that could
                not be taken over after the revocation. Each stopped with it, unless someone else had taken it over in the
                meantime.
            standing_objects (list[CredentialsRevokeCredentialResultStandingObjectsItem] | Unset): What the credential set
                up or owns, listed for review, and for an API key also what it carries on for the keys it was rotated from.
                Revoking deletes none of it.
            predecessors_revoked_count (int | Unset): For an API key: how many keys it replaced in its rotation, still in
                their overlap, were revoked with it. Keys that replaced it never are.
            predecessors_left (int | Unset): For an API key: how many such keys were left working because you may not revoke
                them. They work until their overlap ends.
            predecessors_revoked (list[str] | Unset): The ids of the keys counted in predecessors_revoked_count, to a caller
                who may read the organization's API keys.
            predecessors_not_revoked (list[str] | Unset): The ids of the keys counted in predecessors_left, to a caller who
                may read the organization's API keys.
     """

    revoked: float
    kind: CredentialsRevokeCredentialResultKind
    id: str
    kept: list[CredentialsRevokeCredentialResultKeptItem] | Unset = UNSET
    already_revoked: bool | Unset = UNSET
    keep_failed: list[CredentialsRevokeCredentialResultKeepFailedItem] | Unset = UNSET
    standing_objects: list[CredentialsRevokeCredentialResultStandingObjectsItem] | Unset = UNSET
    predecessors_revoked_count: int | Unset = UNSET
    predecessors_left: int | Unset = UNSET
    predecessors_revoked: list[str] | Unset = UNSET
    predecessors_not_revoked: list[str] | Unset = UNSET
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



        predecessors_revoked_count = self.predecessors_revoked_count

        predecessors_left = self.predecessors_left

        predecessors_revoked: list[str] | Unset = UNSET
        if not isinstance(self.predecessors_revoked, Unset):
            predecessors_revoked = self.predecessors_revoked



        predecessors_not_revoked: list[str] | Unset = UNSET
        if not isinstance(self.predecessors_not_revoked, Unset):
            predecessors_not_revoked = self.predecessors_not_revoked




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
        if predecessors_revoked_count is not UNSET:
            field_dict["predecessors_revoked_count"] = predecessors_revoked_count
        if predecessors_left is not UNSET:
            field_dict["predecessors_left"] = predecessors_left
        if predecessors_revoked is not UNSET:
            field_dict["predecessors_revoked"] = predecessors_revoked
        if predecessors_not_revoked is not UNSET:
            field_dict["predecessors_not_revoked"] = predecessors_not_revoked

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


        predecessors_revoked_count = d.pop("predecessors_revoked_count", UNSET)

        predecessors_left = d.pop("predecessors_left", UNSET)

        predecessors_revoked = cast(list[str], d.pop("predecessors_revoked", UNSET))


        predecessors_not_revoked = cast(list[str], d.pop("predecessors_not_revoked", UNSET))


        credentials_revoke_credential_result = cls(
            revoked=revoked,
            kind=kind,
            id=id,
            kept=kept,
            already_revoked=already_revoked,
            keep_failed=keep_failed,
            standing_objects=standing_objects,
            predecessors_revoked_count=predecessors_revoked_count,
            predecessors_left=predecessors_left,
            predecessors_revoked=predecessors_revoked,
            predecessors_not_revoked=predecessors_not_revoked,
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
