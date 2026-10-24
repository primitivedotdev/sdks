from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credential_kind import CredentialKind
from uuid import UUID






T = TypeVar("T", bound="RevokeCredentialInput")



@_attrs_define
class RevokeCredentialInput:
    """ 
        Attributes:
            kind (CredentialKind): `org_key`, `function_key`, `connected_key`, `oauth`,
                `agent_delegate`, or `cli_user_access` (a person's CLI access in the
                organization through a CLI user login, listed only where those
                logins exist).
            id (UUID):
            reason (str | Unset):
     """

    kind: CredentialKind
    id: UUID
    reason: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        id = str(self.id)

        reason = self.reason


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "id": id,
        })
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = CredentialKind(d.pop("kind"))




        id = UUID(d.pop("id"))




        reason = d.pop("reason", UNSET)

        revoke_credential_input = cls(
            kind=kind,
            id=id,
            reason=reason,
        )

        return revoke_credential_input

