from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_revoke_credential_input_choices_item_decision import CredentialsRevokeCredentialInputChoicesItemDecision
from ..models.credentials_revoke_credential_input_choices_item_kind import CredentialsRevokeCredentialInputChoicesItemKind
from uuid import UUID






T = TypeVar("T", bound="CredentialsRevokeCredentialInputChoicesItem")



@_attrs_define
class CredentialsRevokeCredentialInputChoicesItem:
    """ 
        Attributes:
            kind (CredentialsRevokeCredentialInputChoicesItemKind):
            id (UUID):
            decision (CredentialsRevokeCredentialInputChoicesItemDecision):
     """

    kind: CredentialsRevokeCredentialInputChoicesItemKind
    id: UUID
    decision: CredentialsRevokeCredentialInputChoicesItemDecision





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        id = str(self.id)

        decision = self.decision.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "id": id,
            "decision": decision,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = CredentialsRevokeCredentialInputChoicesItemKind(d.pop("kind"))




        id = UUID(d.pop("id"))




        decision = CredentialsRevokeCredentialInputChoicesItemDecision(d.pop("decision"))




        credentials_revoke_credential_input_choices_item = cls(
            kind=kind,
            id=id,
            decision=decision,
        )

        return credentials_revoke_credential_input_choices_item

