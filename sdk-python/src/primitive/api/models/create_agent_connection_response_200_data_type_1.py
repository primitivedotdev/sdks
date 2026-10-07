from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.create_agent_connection_response_200_data_type_1_connection import CreateAgentConnectionResponse200DataType1Connection





T = TypeVar("T", bound="CreateAgentConnectionResponse200DataType1")



@_attrs_define
class CreateAgentConnectionResponse200DataType1:
    """
        Attributes:
            connection (CreateAgentConnectionResponse200DataType1Connection):
            recovered (bool):
            invitation (None):
     """

    connection: CreateAgentConnectionResponse200DataType1Connection
    recovered: bool
    invitation: None





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_agent_connection_response_200_data_type_1_connection import CreateAgentConnectionResponse200DataType1Connection # noqa: PLC0415
        connection = self.connection.to_dict()

        recovered = self.recovered

        invitation = self.invitation


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "connection": connection,
            "recovered": recovered,
            "invitation": invitation,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_agent_connection_response_200_data_type_1_connection import CreateAgentConnectionResponse200DataType1Connection # noqa: PLC0415
        d = dict(src_dict)
        connection = CreateAgentConnectionResponse200DataType1Connection.from_dict(d.pop("connection"))




        recovered = d.pop("recovered")

        invitation = d.pop("invitation")

        create_agent_connection_response_200_data_type_1 = cls(
            connection=connection,
            recovered=recovered,
            invitation=invitation,
        )

        return create_agent_connection_response_200_data_type_1
