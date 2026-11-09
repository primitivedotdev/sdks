from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_get_key_suggestion_result_usage_daily_item import CredentialsGetKeySuggestionResultUsageDailyItem
  from ..models.credentials_get_key_suggestion_result_usage_mailboxes_type_0 import CredentialsGetKeySuggestionResultUsageMailboxesType0
  from ..models.credentials_get_key_suggestion_result_usage_routes_item import CredentialsGetKeySuggestionResultUsageRoutesItem





T = TypeVar("T", bound="CredentialsGetKeySuggestionResultUsage")



@_attrs_define
class CredentialsGetKeySuggestionResultUsage:
    """ 
        Attributes:
            days (float):
            daily (list[CredentialsGetKeySuggestionResultUsageDailyItem]):
            total_requests (float):
            error_requests (float):
            active_days (float):
            distinct_routes (float):
            top_route_share (float | None):
            routes (list[CredentialsGetKeySuggestionResultUsageRoutesItem]):
            routes_truncated (bool):
            history_truncated (bool):
            mailboxes (CredentialsGetKeySuggestionResultUsageMailboxesType0 | None):
     """

    days: float
    daily: list[CredentialsGetKeySuggestionResultUsageDailyItem]
    total_requests: float
    error_requests: float
    active_days: float
    distinct_routes: float
    top_route_share: float | None
    routes: list[CredentialsGetKeySuggestionResultUsageRoutesItem]
    routes_truncated: bool
    history_truncated: bool
    mailboxes: CredentialsGetKeySuggestionResultUsageMailboxesType0 | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_get_key_suggestion_result_usage_daily_item import CredentialsGetKeySuggestionResultUsageDailyItem # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_usage_mailboxes_type_0 import CredentialsGetKeySuggestionResultUsageMailboxesType0 # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_usage_routes_item import CredentialsGetKeySuggestionResultUsageRoutesItem # noqa: PLC0415
        days = self.days

        daily = []
        for daily_item_data in self.daily:
            daily_item = daily_item_data.to_dict()
            daily.append(daily_item)



        total_requests = self.total_requests

        error_requests = self.error_requests

        active_days = self.active_days

        distinct_routes = self.distinct_routes

        top_route_share: float | None
        top_route_share = self.top_route_share

        routes = []
        for routes_item_data in self.routes:
            routes_item = routes_item_data.to_dict()
            routes.append(routes_item)



        routes_truncated = self.routes_truncated

        history_truncated = self.history_truncated

        mailboxes: dict[str, Any] | None
        if isinstance(self.mailboxes, CredentialsGetKeySuggestionResultUsageMailboxesType0):
            mailboxes = self.mailboxes.to_dict()
        else:
            mailboxes = self.mailboxes


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "days": days,
            "daily": daily,
            "total_requests": total_requests,
            "error_requests": error_requests,
            "active_days": active_days,
            "distinct_routes": distinct_routes,
            "top_route_share": top_route_share,
            "routes": routes,
            "routes_truncated": routes_truncated,
            "history_truncated": history_truncated,
            "mailboxes": mailboxes,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_get_key_suggestion_result_usage_daily_item import CredentialsGetKeySuggestionResultUsageDailyItem # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_usage_mailboxes_type_0 import CredentialsGetKeySuggestionResultUsageMailboxesType0 # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_usage_routes_item import CredentialsGetKeySuggestionResultUsageRoutesItem # noqa: PLC0415
        d = dict(src_dict)
        days = d.pop("days")

        daily = []
        _daily = d.pop("daily")
        for daily_item_data in (_daily):
            daily_item = CredentialsGetKeySuggestionResultUsageDailyItem.from_dict(daily_item_data)



            daily.append(daily_item)


        total_requests = d.pop("total_requests")

        error_requests = d.pop("error_requests")

        active_days = d.pop("active_days")

        distinct_routes = d.pop("distinct_routes")

        def _parse_top_route_share(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        top_route_share = _parse_top_route_share(d.pop("top_route_share"))


        routes = []
        _routes = d.pop("routes")
        for routes_item_data in (_routes):
            routes_item = CredentialsGetKeySuggestionResultUsageRoutesItem.from_dict(routes_item_data)



            routes.append(routes_item)


        routes_truncated = d.pop("routes_truncated")

        history_truncated = d.pop("history_truncated")

        def _parse_mailboxes(data: object) -> CredentialsGetKeySuggestionResultUsageMailboxesType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                mailboxes_type_0 = CredentialsGetKeySuggestionResultUsageMailboxesType0.from_dict(data)



                return mailboxes_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CredentialsGetKeySuggestionResultUsageMailboxesType0 | None, data)

        mailboxes = _parse_mailboxes(d.pop("mailboxes"))


        credentials_get_key_suggestion_result_usage = cls(
            days=days,
            daily=daily,
            total_requests=total_requests,
            error_requests=error_requests,
            active_days=active_days,
            distinct_routes=distinct_routes,
            top_route_share=top_route_share,
            routes=routes,
            routes_truncated=routes_truncated,
            history_truncated=history_truncated,
            mailboxes=mailboxes,
        )


        credentials_get_key_suggestion_result_usage.additional_properties = d
        return credentials_get_key_suggestion_result_usage

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
