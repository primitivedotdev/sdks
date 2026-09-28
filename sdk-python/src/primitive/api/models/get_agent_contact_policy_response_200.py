from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.agent_contact_policy import AgentContactPolicy





T = TypeVar("T", bound="GetAgentContactPolicyResponse200")



@_attrs_define
class GetAgentContactPolicyResponse200:
    """ 
        Attributes:
            success (bool):
            data (AgentContactPolicy):
     """

    success: bool
    data: AgentContactPolicy
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_contact_policy import AgentContactPolicy
        success = self.success

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
        from ..models.agent_contact_policy import AgentContactPolicy
        d = dict(src_dict)
        success = d.pop("success")

        data = AgentContactPolicy.from_dict(d.pop("data"))




        get_agent_contact_policy_response_200 = cls(
            success=success,
            data=data,
        )


        get_agent_contact_policy_response_200.additional_properties = d
        return get_agent_contact_policy_response_200

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
