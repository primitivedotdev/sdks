from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.agent_work_record import AgentWorkRecord





T = TypeVar("T", bound="AgentWorkPage")



@_attrs_define
class AgentWorkPage:
    """ 
        Attributes:
            records (list[AgentWorkRecord]):
            next_cursor (None | UUID):
     """

    records: list[AgentWorkRecord]
    next_cursor: None | UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_work_record import AgentWorkRecord # noqa: PLC0415
        records = []
        for records_item_data in self.records:
            records_item = records_item_data.to_dict()
            records.append(records_item)



        next_cursor: None | str
        if isinstance(self.next_cursor, UUID):
            next_cursor = str(self.next_cursor)
        else:
            next_cursor = self.next_cursor


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "records": records,
            "nextCursor": next_cursor,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_work_record import AgentWorkRecord # noqa: PLC0415
        d = dict(src_dict)
        records = []
        _records = d.pop("records")
        for records_item_data in (_records):
            records_item = AgentWorkRecord.from_dict(records_item_data)



            records.append(records_item)


        def _parse_next_cursor(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_cursor_type_0 = UUID(data)



                return next_cursor_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        next_cursor = _parse_next_cursor(d.pop("nextCursor"))


        agent_work_page = cls(
            records=records,
            next_cursor=next_cursor,
        )


        agent_work_page.additional_properties = d
        return agent_work_page

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
