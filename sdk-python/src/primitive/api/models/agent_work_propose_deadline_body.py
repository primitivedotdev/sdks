from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="AgentWorkProposeDeadlineBody")



@_attrs_define
class AgentWorkProposeDeadlineBody:
    """ 
        Attributes:
            expected_version (int):
            proposed_deadline_at (datetime.datetime | None):
     """

    expected_version: int
    proposed_deadline_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        expected_version = self.expected_version

        proposed_deadline_at: None | str
        if isinstance(self.proposed_deadline_at, datetime.datetime):
            proposed_deadline_at = self.proposed_deadline_at.isoformat()
        else:
            proposed_deadline_at = self.proposed_deadline_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "expectedVersion": expected_version,
            "proposedDeadlineAt": proposed_deadline_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        expected_version = d.pop("expectedVersion")

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


        agent_work_propose_deadline_body = cls(
            expected_version=expected_version,
            proposed_deadline_at=proposed_deadline_at,
        )

        return agent_work_propose_deadline_body

