from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.agent_connection import AgentConnection
  from ..models.invite_agent_connection_response_200_data_invitation import InviteAgentConnectionResponse200DataInvitation





T = TypeVar("T", bound="InviteAgentConnectionResponse200Data")



@_attrs_define
class InviteAgentConnectionResponse200Data:
    """
        Attributes:
            connection (AgentConnection):
            invitation (InviteAgentConnectionResponse200DataInvitation):
     """

    connection: AgentConnection
    invitation: InviteAgentConnectionResponse200DataInvitation
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_connection import AgentConnection # noqa: PLC0415
        from ..models.invite_agent_connection_response_200_data_invitation import InviteAgentConnectionResponse200DataInvitation # noqa: PLC0415
        connection = self.connection.to_dict()

        invitation = self.invitation.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "connection": connection,
            "invitation": invitation,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_connection import AgentConnection # noqa: PLC0415
        from ..models.invite_agent_connection_response_200_data_invitation import InviteAgentConnectionResponse200DataInvitation # noqa: PLC0415
        d = dict(src_dict)
        connection = AgentConnection.from_dict(d.pop("connection"))




        invitation = InviteAgentConnectionResponse200DataInvitation.from_dict(d.pop("invitation"))




        invite_agent_connection_response_200_data = cls(
            connection=connection,
            invitation=invitation,
        )


        invite_agent_connection_response_200_data.additional_properties = d
        return invite_agent_connection_response_200_data

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
