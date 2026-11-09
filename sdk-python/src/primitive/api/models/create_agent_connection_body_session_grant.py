from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="CreateAgentConnectionBodySessionGrant")



@_attrs_define
class CreateAgentConnectionBodySessionGrant:
    """ The owner's single-use session grant for this exact session on this machine. Not a secret; redeeming it also needs
    the owner's own login. Cannot be combined with address or a shared ownership_kind.

        Attributes:
            id (UUID):
            session_id (UUID):
            machine_id (str):
     """

    id: UUID
    session_id: UUID
    machine_id: str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        session_id = str(self.session_id)

        machine_id = self.machine_id


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "session_id": session_id,
            "machine_id": machine_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        session_id = UUID(d.pop("session_id"))




        machine_id = d.pop("machine_id")

        create_agent_connection_body_session_grant = cls(
            id=id,
            session_id=session_id,
            machine_id=machine_id,
        )

        return create_agent_connection_body_session_grant
