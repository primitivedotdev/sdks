from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="InviteAgentConnectionBody")



@_attrs_define
class InviteAgentConnectionBody:
    """
        Attributes:
            pending_only (bool | Unset): Issue setup only while this exact connection is pending. A claimed, connected or
                revoked connection returns connection_already_claimed without changing its credential.
     """

    pending_only: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        pending_only = self.pending_only


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if pending_only is not UNSET:
            field_dict["pending_only"] = pending_only

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        pending_only = d.pop("pending_only", UNSET)

        invite_agent_connection_body = cls(
            pending_only=pending_only,
        )

        return invite_agent_connection_body
