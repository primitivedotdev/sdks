from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.agent_connection import AgentConnection
  from ..models.get_own_agent_connection_response_200_data_receiver import GetOwnAgentConnectionResponse200DataReceiver





T = TypeVar("T", bound="GetOwnAgentConnectionResponse200Data")



@_attrs_define
class GetOwnAgentConnectionResponse200Data:
    """
        Attributes:
            connection (AgentConnection):
            org_id (UUID):
            receiver (GetOwnAgentConnectionResponse200DataReceiver): Whether this peer is currently reading its mail, from
                the server's record of its own successful mail reads (GET /emails list reads and pull endpoint pulls made with
                its connection key). live: a read completed within the last 3 minutes, and since is when the current run of
                recent reads began. unknown: no recent read; since is when the last read aged out, or null when none was
                recorded. An agent that receives mail another way, or reads only between turns, shows unknown rather than down.
                down is reserved for an explicit report that the receiver stopped. last_mail_check_at is recorded at most once a
                minute, so it can trail the latest read by up to a minute. None of this says whether a model has read a
                particular message.
     """

    connection: AgentConnection
    org_id: UUID
    receiver: GetOwnAgentConnectionResponse200DataReceiver
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_connection import AgentConnection # noqa: PLC0415
        from ..models.get_own_agent_connection_response_200_data_receiver import GetOwnAgentConnectionResponse200DataReceiver # noqa: PLC0415
        connection = self.connection.to_dict()

        org_id = str(self.org_id)

        receiver = self.receiver.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "connection": connection,
            "org_id": org_id,
            "receiver": receiver,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_connection import AgentConnection # noqa: PLC0415
        from ..models.get_own_agent_connection_response_200_data_receiver import GetOwnAgentConnectionResponse200DataReceiver # noqa: PLC0415
        d = dict(src_dict)
        connection = AgentConnection.from_dict(d.pop("connection"))




        org_id = UUID(d.pop("org_id"))




        receiver = GetOwnAgentConnectionResponse200DataReceiver.from_dict(d.pop("receiver"))




        get_own_agent_connection_response_200_data = cls(
            connection=connection,
            org_id=org_id,
            receiver=receiver,
        )


        get_own_agent_connection_response_200_data.additional_properties = d
        return get_own_agent_connection_response_200_data

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
