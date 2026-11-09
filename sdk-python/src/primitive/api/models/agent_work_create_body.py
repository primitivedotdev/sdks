from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="AgentWorkCreateBody")



@_attrs_define
class AgentWorkCreateBody:
    """ 
        Attributes:
            work_title (str):
            work_detail (str):
            proposed_deadline_at (datetime.datetime | None | Unset):
     """

    work_title: str
    work_detail: str
    proposed_deadline_at: datetime.datetime | None | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        work_title = self.work_title

        work_detail = self.work_detail

        proposed_deadline_at: None | str | Unset
        if isinstance(self.proposed_deadline_at, Unset):
            proposed_deadline_at = UNSET
        elif isinstance(self.proposed_deadline_at, datetime.datetime):
            proposed_deadline_at = self.proposed_deadline_at.isoformat()
        else:
            proposed_deadline_at = self.proposed_deadline_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "workTitle": work_title,
            "workDetail": work_detail,
        })
        if proposed_deadline_at is not UNSET:
            field_dict["proposedDeadlineAt"] = proposed_deadline_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        work_title = d.pop("workTitle")

        work_detail = d.pop("workDetail")

        def _parse_proposed_deadline_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                proposed_deadline_at_type_0 = datetime.datetime.fromisoformat(data)



                return proposed_deadline_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        proposed_deadline_at = _parse_proposed_deadline_at(d.pop("proposedDeadlineAt", UNSET))


        agent_work_create_body = cls(
            work_title=work_title,
            work_detail=work_detail,
            proposed_deadline_at=proposed_deadline_at,
        )

        return agent_work_create_body

