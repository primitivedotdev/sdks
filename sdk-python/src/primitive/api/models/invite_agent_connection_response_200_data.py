from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.invite_agent_connection_response_200_data_connection import InviteAgentConnectionResponse200DataConnection
  from ..models.invite_agent_connection_response_200_data_invitation import InviteAgentConnectionResponse200DataInvitation





T = TypeVar("T", bound="InviteAgentConnectionResponse200Data")



@_attrs_define
class InviteAgentConnectionResponse200Data:
    """
        Attributes:
            connection (InviteAgentConnectionResponse200DataConnection):
            invitation (InviteAgentConnectionResponse200DataInvitation):
     """

    connection: InviteAgentConnectionResponse200DataConnection
    invitation: InviteAgentConnectionResponse200DataInvitation





    def to_dict(self) -> dict[str, Any]:
        from ..models.invite_agent_connection_response_200_data_connection import InviteAgentConnectionResponse200DataConnection # noqa: PLC0415
        from ..models.invite_agent_connection_response_200_data_invitation import InviteAgentConnectionResponse200DataInvitation # noqa: PLC0415
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
        from ..models.invite_agent_connection_response_200_data_connection import InviteAgentConnectionResponse200DataConnection # noqa: PLC0415
        from ..models.invite_agent_connection_response_200_data_invitation import InviteAgentConnectionResponse200DataInvitation # noqa: PLC0415
        d = dict(src_dict)
        connection = InviteAgentConnectionResponse200DataConnection.from_dict(d.pop("connection"))




        invitation = InviteAgentConnectionResponse200DataInvitation.from_dict(d.pop("invitation"))




        invite_agent_connection_response_200_data = cls(
            connection=connection,
            invitation=invitation,
        )

        return invite_agent_connection_response_200_data
