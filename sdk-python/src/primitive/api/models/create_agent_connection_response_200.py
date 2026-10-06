from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.create_agent_connection_response_200_data_type_0 import CreateAgentConnectionResponse200DataType0
  from ..models.create_agent_connection_response_200_data_type_1 import CreateAgentConnectionResponse200DataType1





T = TypeVar("T", bound="CreateAgentConnectionResponse200")



@_attrs_define
class CreateAgentConnectionResponse200:
    """
        Attributes:
            success (bool):
            data (CreateAgentConnectionResponse200DataType0 | CreateAgentConnectionResponse200DataType1):
     """

    success: bool
    data: CreateAgentConnectionResponse200DataType0 | CreateAgentConnectionResponse200DataType1
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_agent_connection_response_200_data_type_0 import CreateAgentConnectionResponse200DataType0 # noqa: PLC0415
        from ..models.create_agent_connection_response_200_data_type_1 import CreateAgentConnectionResponse200DataType1 # noqa: PLC0415
        success = self.success

        data: dict[str, Any]
        if isinstance(self.data, CreateAgentConnectionResponse200DataType0):
            data = self.data.to_dict()
        else:
            data = self.data.to_dict()



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
            "data": data,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_agent_connection_response_200_data_type_0 import CreateAgentConnectionResponse200DataType0 # noqa: PLC0415
        from ..models.create_agent_connection_response_200_data_type_1 import CreateAgentConnectionResponse200DataType1 # noqa: PLC0415
        d = dict(src_dict)
        success = d.pop("success")

        def _parse_data(data: object) -> CreateAgentConnectionResponse200DataType0 | CreateAgentConnectionResponse200DataType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                data_type_0 = CreateAgentConnectionResponse200DataType0.from_dict(data)



                return data_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            data_type_1 = CreateAgentConnectionResponse200DataType1.from_dict(data)



            return data_type_1

        data = _parse_data(d.pop("data"))


        create_agent_connection_response_200 = cls(
            success=success,
            data=data,
        )


        create_agent_connection_response_200.additional_properties = d
        return create_agent_connection_response_200

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
