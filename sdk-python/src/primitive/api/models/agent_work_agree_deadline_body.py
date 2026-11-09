from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="AgentWorkAgreeDeadlineBody")



@_attrs_define
class AgentWorkAgreeDeadlineBody:
    """ 
        Attributes:
            expected_version (int):
            agreement_id (UUID):
            due_at (datetime.datetime):
     """

    expected_version: int
    agreement_id: UUID
    due_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        expected_version = self.expected_version

        agreement_id = str(self.agreement_id)

        due_at = self.due_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "expectedVersion": expected_version,
            "agreementId": agreement_id,
            "dueAt": due_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        expected_version = d.pop("expectedVersion")

        agreement_id = UUID(d.pop("agreementId"))




        due_at = datetime.datetime.fromisoformat(d.pop("dueAt"))




        agent_work_agree_deadline_body = cls(
            expected_version=expected_version,
            agreement_id=agreement_id,
            due_at=due_at,
        )

        return agent_work_agree_deadline_body

