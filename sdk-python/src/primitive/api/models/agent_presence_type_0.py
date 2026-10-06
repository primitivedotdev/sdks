from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="AgentPresenceType0")



@_attrs_define
class AgentPresenceType0:
    """
        Attributes:
            last_checked_at (datetime.datetime):
            expires_at (datetime.datetime):
            valid_for_ms (int):
     """

    last_checked_at: datetime.datetime
    expires_at: datetime.datetime
    valid_for_ms: int





    def to_dict(self) -> dict[str, Any]:
        last_checked_at = self.last_checked_at.isoformat()

        expires_at = self.expires_at.isoformat()

        valid_for_ms = self.valid_for_ms


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "last_checked_at": last_checked_at,
            "expires_at": expires_at,
            "valid_for_ms": valid_for_ms,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        last_checked_at = datetime.datetime.fromisoformat(d.pop("last_checked_at"))




        expires_at = datetime.datetime.fromisoformat(d.pop("expires_at"))




        valid_for_ms = d.pop("valid_for_ms")

        agent_presence_type_0 = cls(
            last_checked_at=last_checked_at,
            expires_at=expires_at,
            valid_for_ms=valid_for_ms,
        )

        return agent_presence_type_0
