from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="AgentWorkRecordDeadlineType0")



@_attrs_define
class AgentWorkRecordDeadlineType0:
    """ 
        Attributes:
            id (UUID):
            due_at (datetime.datetime):
            agreed_at (datetime.datetime):
            agreed_by_user_id (UUID):
            work_version (int):
     """

    id: UUID
    due_at: datetime.datetime
    agreed_at: datetime.datetime
    agreed_by_user_id: UUID
    work_version: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        due_at = self.due_at.isoformat()

        agreed_at = self.agreed_at.isoformat()

        agreed_by_user_id = str(self.agreed_by_user_id)

        work_version = self.work_version


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "dueAt": due_at,
            "agreedAt": agreed_at,
            "agreedByUserId": agreed_by_user_id,
            "workVersion": work_version,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        due_at = datetime.datetime.fromisoformat(d.pop("dueAt"))




        agreed_at = datetime.datetime.fromisoformat(d.pop("agreedAt"))




        agreed_by_user_id = UUID(d.pop("agreedByUserId"))




        work_version = d.pop("workVersion")

        agent_work_record_deadline_type_0 = cls(
            id=id,
            due_at=due_at,
            agreed_at=agreed_at,
            agreed_by_user_id=agreed_by_user_id,
            work_version=work_version,
        )


        agent_work_record_deadline_type_0.additional_properties = d
        return agent_work_record_deadline_type_0

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
