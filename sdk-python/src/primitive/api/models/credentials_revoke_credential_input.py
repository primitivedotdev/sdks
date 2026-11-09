from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_revoke_credential_input_kind import CredentialsRevokeCredentialInputKind
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.credentials_revoke_credential_input_choices_item import CredentialsRevokeCredentialInputChoicesItem





T = TypeVar("T", bound="CredentialsRevokeCredentialInput")



@_attrs_define
class CredentialsRevokeCredentialInput:
    """ 
        Attributes:
            kind (CredentialsRevokeCredentialInputKind):
            id (UUID):
            reason (str | Unset):
            choices (list[CredentialsRevokeCredentialInputChoicesItem] | Unset):
     """

    kind: CredentialsRevokeCredentialInputKind
    id: UUID
    reason: str | Unset = UNSET
    choices: list[CredentialsRevokeCredentialInputChoicesItem] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_revoke_credential_input_choices_item import CredentialsRevokeCredentialInputChoicesItem # noqa: PLC0415
        kind = self.kind.value

        id = str(self.id)

        reason = self.reason

        choices: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.choices, Unset):
            choices = []
            for choices_item_data in self.choices:
                choices_item = choices_item_data.to_dict()
                choices.append(choices_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "id": id,
        })
        if reason is not UNSET:
            field_dict["reason"] = reason
        if choices is not UNSET:
            field_dict["choices"] = choices

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_revoke_credential_input_choices_item import CredentialsRevokeCredentialInputChoicesItem # noqa: PLC0415
        d = dict(src_dict)
        kind = CredentialsRevokeCredentialInputKind(d.pop("kind"))




        id = UUID(d.pop("id"))




        reason = d.pop("reason", UNSET)

        _choices = d.pop("choices", UNSET)
        choices: list[CredentialsRevokeCredentialInputChoicesItem] | Unset = UNSET
        if _choices is not UNSET:
            choices = []
            for choices_item_data in _choices:
                choices_item = CredentialsRevokeCredentialInputChoicesItem.from_dict(choices_item_data)



                choices.append(choices_item)


        credentials_revoke_credential_input = cls(
            kind=kind,
            id=id,
            reason=reason,
            choices=choices,
        )

        return credentials_revoke_credential_input

