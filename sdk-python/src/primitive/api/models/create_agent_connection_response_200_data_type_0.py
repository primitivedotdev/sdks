from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.create_agent_connection_response_200_data_type_0_connection import CreateAgentConnectionResponse200DataType0Connection
  from ..models.create_agent_connection_response_200_data_type_0_invitation import CreateAgentConnectionResponse200DataType0Invitation





T = TypeVar("T", bound="CreateAgentConnectionResponse200DataType0")



@_attrs_define
class CreateAgentConnectionResponse200DataType0:
    """
        Attributes:
            connection (CreateAgentConnectionResponse200DataType0Connection):
            invitation (CreateAgentConnectionResponse200DataType0Invitation):
     """

    connection: CreateAgentConnectionResponse200DataType0Connection
    invitation: CreateAgentConnectionResponse200DataType0Invitation





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_agent_connection_response_200_data_type_0_connection import CreateAgentConnectionResponse200DataType0Connection # noqa: PLC0415
        from ..models.create_agent_connection_response_200_data_type_0_invitation import CreateAgentConnectionResponse200DataType0Invitation # noqa: PLC0415
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
        from ..models.create_agent_connection_response_200_data_type_0_connection import CreateAgentConnectionResponse200DataType0Connection # noqa: PLC0415
        from ..models.create_agent_connection_response_200_data_type_0_invitation import CreateAgentConnectionResponse200DataType0Invitation # noqa: PLC0415
        d = dict(src_dict)
        connection = CreateAgentConnectionResponse200DataType0Connection.from_dict(d.pop("connection"))




        invitation = CreateAgentConnectionResponse200DataType0Invitation.from_dict(d.pop("invitation"))




        create_agent_connection_response_200_data_type_0 = cls(
            connection=connection,
            invitation=invitation,
        )

        return create_agent_connection_response_200_data_type_0
