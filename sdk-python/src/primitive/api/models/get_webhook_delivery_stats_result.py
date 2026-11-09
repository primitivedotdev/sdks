from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="GetWebhookDeliveryStatsResult")



@_attrs_define
class GetWebhookDeliveryStatsResult:
    """ 
        Attributes:
            since (datetime.datetime):
            clean_success (int):
            recovered (int):
            failed (int):
            regressed (int):
     """

    since: datetime.datetime
    clean_success: int
    recovered: int
    failed: int
    regressed: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        since = self.since.isoformat()

        clean_success = self.clean_success

        recovered = self.recovered

        failed = self.failed

        regressed = self.regressed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "since": since,
            "clean_success": clean_success,
            "recovered": recovered,
            "failed": failed,
            "regressed": regressed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        since = datetime.datetime.fromisoformat(d.pop("since"))




        clean_success = d.pop("clean_success")

        recovered = d.pop("recovered")

        failed = d.pop("failed")

        regressed = d.pop("regressed")

        get_webhook_delivery_stats_result = cls(
            since=since,
            clean_success=clean_success,
            recovered=recovered,
            failed=failed,
            regressed=regressed,
        )


        get_webhook_delivery_stats_result.additional_properties = d
        return get_webhook_delivery_stats_result

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
