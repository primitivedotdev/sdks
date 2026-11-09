from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_work_manage_state_body_status import AgentWorkManageStateBodyStatus






T = TypeVar("T", bound="AgentWorkManageStateBody")



@_attrs_define
class AgentWorkManageStateBody:
    """ 
        Attributes:
            expected_version (int):
            status (AgentWorkManageStateBodyStatus):
     """

    expected_version: int
    status: AgentWorkManageStateBodyStatus





    def to_dict(self) -> dict[str, Any]:
        expected_version = self.expected_version

        status = self.status.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "expectedVersion": expected_version,
            "status": status,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        expected_version = d.pop("expectedVersion")

        status = AgentWorkManageStateBodyStatus(d.pop("status"))




        agent_work_manage_state_body = cls(
            expected_version=expected_version,
            status=status,
        )

        return agent_work_manage_state_body

