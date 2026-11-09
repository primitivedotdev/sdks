from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.agent_connection import AgentConnection
  from ..models.create_agent_connection_response_200_data_invitation_type_0 import CreateAgentConnectionResponse200DataInvitationType0





T = TypeVar("T", bound="CreateAgentConnectionResponse200Data")



@_attrs_define
class CreateAgentConnectionResponse200Data:
    """
        Attributes:
            connection (AgentConnection):
            invitation (CreateAgentConnectionResponse200DataInvitationType0 | None):
            recovered (bool | Unset):
     """

    connection: AgentConnection
    invitation: CreateAgentConnectionResponse200DataInvitationType0 | None
    recovered: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_connection import AgentConnection # noqa: PLC0415
        from ..models.create_agent_connection_response_200_data_invitation_type_0 import CreateAgentConnectionResponse200DataInvitationType0 # noqa: PLC0415
        connection = self.connection.to_dict()

        invitation: dict[str, Any] | None
        if isinstance(self.invitation, CreateAgentConnectionResponse200DataInvitationType0):
            invitation = self.invitation.to_dict()
        else:
            invitation = self.invitation

        recovered = self.recovered


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "connection": connection,
            "invitation": invitation,
        })
        if recovered is not UNSET:
            field_dict["recovered"] = recovered

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_connection import AgentConnection # noqa: PLC0415
        from ..models.create_agent_connection_response_200_data_invitation_type_0 import CreateAgentConnectionResponse200DataInvitationType0 # noqa: PLC0415
        d = dict(src_dict)
        connection = AgentConnection.from_dict(d.pop("connection"))




        def _parse_invitation(data: object) -> CreateAgentConnectionResponse200DataInvitationType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                invitation_type_0 = CreateAgentConnectionResponse200DataInvitationType0.from_dict(data)



                return invitation_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CreateAgentConnectionResponse200DataInvitationType0 | None, data)

        invitation = _parse_invitation(d.pop("invitation"))


        recovered = d.pop("recovered", UNSET)

        create_agent_connection_response_200_data = cls(
            connection=connection,
            invitation=invitation,
            recovered=recovered,
        )


        create_agent_connection_response_200_data.additional_properties = d
        return create_agent_connection_response_200_data

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
