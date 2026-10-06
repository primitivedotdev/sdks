from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="InviteAgentConnectionResponse200DataInvitation")



@_attrs_define
class InviteAgentConnectionResponse200DataInvitation:
    """
        Attributes:
            claim_url (str):
            expires_at (datetime.datetime):
     """

    claim_url: str
    expires_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        claim_url = self.claim_url

        expires_at = self.expires_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "claim_url": claim_url,
            "expires_at": expires_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        claim_url = d.pop("claim_url")

        expires_at = datetime.datetime.fromisoformat(d.pop("expires_at"))




        invite_agent_connection_response_200_data_invitation = cls(
            claim_url=claim_url,
            expires_at=expires_at,
        )

        return invite_agent_connection_response_200_data_invitation
