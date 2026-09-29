from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.create_agent_connection_response_200_data_connection import CreateAgentConnectionResponse200DataConnection
  from ..models.create_agent_connection_response_200_data_invitation import CreateAgentConnectionResponse200DataInvitation





T = TypeVar("T", bound="CreateAgentConnectionResponse200Data")



@_attrs_define
class CreateAgentConnectionResponse200Data:
    """
        Attributes:
            connection (CreateAgentConnectionResponse200DataConnection):
            invitation (CreateAgentConnectionResponse200DataInvitation):
     """

    connection: CreateAgentConnectionResponse200DataConnection
    invitation: CreateAgentConnectionResponse200DataInvitation





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_agent_connection_response_200_data_connection import CreateAgentConnectionResponse200DataConnection
        from ..models.create_agent_connection_response_200_data_invitation import CreateAgentConnectionResponse200DataInvitation
        connection = self.connection.to_dict()

        invitation = self.invitation.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "connection": connection,
            "invitation": invitation,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_agent_connection_response_200_data_connection import CreateAgentConnectionResponse200DataConnection
        from ..models.create_agent_connection_response_200_data_invitation import CreateAgentConnectionResponse200DataInvitation
        d = dict(src_dict)
        connection = CreateAgentConnectionResponse200DataConnection.from_dict(d.pop("connection"))




        invitation = CreateAgentConnectionResponse200DataInvitation.from_dict(d.pop("invitation"))




        create_agent_connection_response_200_data = cls(
            connection=connection,
            invitation=invitation,
        )

        return create_agent_connection_response_200_data
