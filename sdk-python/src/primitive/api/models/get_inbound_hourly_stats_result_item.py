from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="GetInboundHourlyStatsResultItem")



@_attrs_define
class GetInboundHourlyStatsResultItem:
    """ 
        Attributes:
            hour (datetime.datetime):
            accepted (int):
            failing (int):
            rejected (int):
     """

    hour: datetime.datetime
    accepted: int
    failing: int
    rejected: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        hour = self.hour.isoformat()

        accepted = self.accepted

        failing = self.failing

        rejected = self.rejected


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "hour": hour,
            "accepted": accepted,
            "failing": failing,
            "rejected": rejected,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        hour = datetime.datetime.fromisoformat(d.pop("hour"))




        accepted = d.pop("accepted")

        failing = d.pop("failing")

        rejected = d.pop("rejected")

        get_inbound_hourly_stats_result_item = cls(
            hour=hour,
            accepted=accepted,
            failing=failing,
            rejected=rejected,
        )


        get_inbound_hourly_stats_result_item.additional_properties = d
        return get_inbound_hourly_stats_result_item

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
