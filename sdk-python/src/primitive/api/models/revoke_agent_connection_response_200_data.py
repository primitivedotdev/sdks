from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.revoke_agent_connection_response_200_data_connection import RevokeAgentConnectionResponse200DataConnection





T = TypeVar("T", bound="RevokeAgentConnectionResponse200Data")



@_attrs_define
class RevokeAgentConnectionResponse200Data:
    """
        Attributes:
            connection (RevokeAgentConnectionResponse200DataConnection):
     """

    connection: RevokeAgentConnectionResponse200DataConnection





    def to_dict(self) -> dict[str, Any]:
        from ..models.revoke_agent_connection_response_200_data_connection import RevokeAgentConnectionResponse200DataConnection # noqa: PLC0415
        connection = self.connection.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "connection": connection,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.revoke_agent_connection_response_200_data_connection import RevokeAgentConnectionResponse200DataConnection # noqa: PLC0415
        d = dict(src_dict)
        connection = RevokeAgentConnectionResponse200DataConnection.from_dict(d.pop("connection"))




        revoke_agent_connection_response_200_data = cls(
            connection=connection,
        )

        return revoke_agent_connection_response_200_data
