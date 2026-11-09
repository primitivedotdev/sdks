from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_work_record_status import AgentWorkRecordStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.agent_work_record_created_by import AgentWorkRecordCreatedBy
  from ..models.agent_work_record_deadline_type_0 import AgentWorkRecordDeadlineType0
  from ..models.agent_work_record_updated_by import AgentWorkRecordUpdatedBy





T = TypeVar("T", bound="AgentWorkRecord")



@_attrs_define
class AgentWorkRecord:
    """ 
        Attributes:
            id (UUID):
            agent_id (UUID):
            version (int):
            work_title (None | str):
            work_detail (None | str):
            status (AgentWorkRecordStatus):
            proposed_deadline_at (datetime.datetime | None):
            deadline (AgentWorkRecordDeadlineType0 | None):
            created_by (AgentWorkRecordCreatedBy):
            updated_by (AgentWorkRecordUpdatedBy):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    agent_id: UUID
    version: int
    work_title: None | str
    work_detail: None | str
    status: AgentWorkRecordStatus
    proposed_deadline_at: datetime.datetime | None
    deadline: AgentWorkRecordDeadlineType0 | None
    created_by: AgentWorkRecordCreatedBy
    updated_by: AgentWorkRecordUpdatedBy
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_work_record_created_by import AgentWorkRecordCreatedBy # noqa: PLC0415
        from ..models.agent_work_record_deadline_type_0 import AgentWorkRecordDeadlineType0 # noqa: PLC0415
        from ..models.agent_work_record_updated_by import AgentWorkRecordUpdatedBy # noqa: PLC0415
        id = str(self.id)

        agent_id = str(self.agent_id)

        version = self.version

        work_title: None | str
        work_title = self.work_title

        work_detail: None | str
        work_detail = self.work_detail

        status = self.status.value

        proposed_deadline_at: None | str
        if isinstance(self.proposed_deadline_at, datetime.datetime):
            proposed_deadline_at = self.proposed_deadline_at.isoformat()
        else:
            proposed_deadline_at = self.proposed_deadline_at

        deadline: dict[str, Any] | None
        if isinstance(self.deadline, AgentWorkRecordDeadlineType0):
            deadline = self.deadline.to_dict()
        else:
            deadline = self.deadline

        created_by = self.created_by.to_dict()

        updated_by = self.updated_by.to_dict()

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "agentId": agent_id,
            "version": version,
            "workTitle": work_title,
            "workDetail": work_detail,
            "status": status,
            "proposedDeadlineAt": proposed_deadline_at,
            "deadline": deadline,
            "createdBy": created_by,
            "updatedBy": updated_by,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_work_record_created_by import AgentWorkRecordCreatedBy # noqa: PLC0415
        from ..models.agent_work_record_deadline_type_0 import AgentWorkRecordDeadlineType0 # noqa: PLC0415
        from ..models.agent_work_record_updated_by import AgentWorkRecordUpdatedBy # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        agent_id = UUID(d.pop("agentId"))




        version = d.pop("version")

        def _parse_work_title(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        work_title = _parse_work_title(d.pop("workTitle"))


        def _parse_work_detail(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        work_detail = _parse_work_detail(d.pop("workDetail"))


        status = AgentWorkRecordStatus(d.pop("status"))




        def _parse_proposed_deadline_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                proposed_deadline_at_type_0 = datetime.datetime.fromisoformat(data)



                return proposed_deadline_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        proposed_deadline_at = _parse_proposed_deadline_at(d.pop("proposedDeadlineAt"))


        def _parse_deadline(data: object) -> AgentWorkRecordDeadlineType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                deadline_type_0 = AgentWorkRecordDeadlineType0.from_dict(data)



                return deadline_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AgentWorkRecordDeadlineType0 | None, data)

        deadline = _parse_deadline(d.pop("deadline"))


        created_by = AgentWorkRecordCreatedBy.from_dict(d.pop("createdBy"))




        updated_by = AgentWorkRecordUpdatedBy.from_dict(d.pop("updatedBy"))




        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        agent_work_record = cls(
            id=id,
            agent_id=agent_id,
            version=version,
            work_title=work_title,
            work_detail=work_detail,
            status=status,
            proposed_deadline_at=proposed_deadline_at,
            deadline=deadline,
            created_by=created_by,
            updated_by=updated_by,
            created_at=created_at,
            updated_at=updated_at,
        )


        agent_work_record.additional_properties = d
        return agent_work_record

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
