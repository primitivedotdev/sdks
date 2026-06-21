from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="PlanLimits")



@_attrs_define
class PlanLimits:
    """ Plan-derived quota limits for an account.

        Attributes:
            storage_mb (float):
            send_per_hour (float):
            send_per_day (float):
            api_per_minute (float):
            webhooks_max_global (float | None):
            webhooks_per_domain (bool):
            filters_per_domain (bool):
            spam_thresholds_per_domain (bool):
     """

    storage_mb: float
    send_per_hour: float
    send_per_day: float
    api_per_minute: float
    webhooks_max_global: float | None
    webhooks_per_domain: bool
    filters_per_domain: bool
    spam_thresholds_per_domain: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        storage_mb = self.storage_mb

        send_per_hour = self.send_per_hour

        send_per_day = self.send_per_day

        api_per_minute = self.api_per_minute

        webhooks_max_global: float | None
        webhooks_max_global = self.webhooks_max_global

        webhooks_per_domain = self.webhooks_per_domain

        filters_per_domain = self.filters_per_domain

        spam_thresholds_per_domain = self.spam_thresholds_per_domain


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "storage_mb": storage_mb,
            "send_per_hour": send_per_hour,
            "send_per_day": send_per_day,
            "api_per_minute": api_per_minute,
            "webhooks_max_global": webhooks_max_global,
            "webhooks_per_domain": webhooks_per_domain,
            "filters_per_domain": filters_per_domain,
            "spam_thresholds_per_domain": spam_thresholds_per_domain,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        storage_mb = d.pop("storage_mb")

        send_per_hour = d.pop("send_per_hour")

        send_per_day = d.pop("send_per_day")

        api_per_minute = d.pop("api_per_minute")

        def _parse_webhooks_max_global(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        webhooks_max_global = _parse_webhooks_max_global(d.pop("webhooks_max_global"))


        webhooks_per_domain = d.pop("webhooks_per_domain")

        filters_per_domain = d.pop("filters_per_domain")

        spam_thresholds_per_domain = d.pop("spam_thresholds_per_domain")

        plan_limits = cls(
            storage_mb=storage_mb,
            send_per_hour=send_per_hour,
            send_per_day=send_per_day,
            api_per_minute=api_per_minute,
            webhooks_max_global=webhooks_max_global,
            webhooks_per_domain=webhooks_per_domain,
            filters_per_domain=filters_per_domain,
            spam_thresholds_per_domain=spam_thresholds_per_domain,
        )


        plan_limits.additional_properties = d
        return plan_limits

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
