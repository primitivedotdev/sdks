from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.pull_webhook_response_data_handler_timeout_seconds import PullWebhookResponseDataHandlerTimeoutSeconds
from ..models.pull_webhook_response_data_retention_seconds import PullWebhookResponseDataRetentionSeconds
from typing import cast

if TYPE_CHECKING:
  from ..models.pull_webhook_response_data_delivery_type_0 import PullWebhookResponseDataDeliveryType0





T = TypeVar("T", bound="PullWebhookResponseData")



@_attrs_define
class PullWebhookResponseData:
    """ 
        Attributes:
            delivery (None | PullWebhookResponseDataDeliveryType0):
            backlog (int):
            gap_count (int):
            last_gap_reason (None | str):
            retention_seconds (PullWebhookResponseDataRetentionSeconds):
            handler_timeout_seconds (PullWebhookResponseDataHandlerTimeoutSeconds):
     """

    delivery: None | PullWebhookResponseDataDeliveryType0
    backlog: int
    gap_count: int
    last_gap_reason: None | str
    retention_seconds: PullWebhookResponseDataRetentionSeconds
    handler_timeout_seconds: PullWebhookResponseDataHandlerTimeoutSeconds





    def to_dict(self) -> dict[str, Any]:
        from ..models.pull_webhook_response_data_delivery_type_0 import PullWebhookResponseDataDeliveryType0
        delivery: dict[str, Any] | None
        if isinstance(self.delivery, PullWebhookResponseDataDeliveryType0):
            delivery = self.delivery.to_dict()
        else:
            delivery = self.delivery

        backlog = self.backlog

        gap_count = self.gap_count

        last_gap_reason: None | str
        last_gap_reason = self.last_gap_reason

        retention_seconds = self.retention_seconds.value

        handler_timeout_seconds = self.handler_timeout_seconds.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "delivery": delivery,
            "backlog": backlog,
            "gap_count": gap_count,
            "last_gap_reason": last_gap_reason,
            "retention_seconds": retention_seconds,
            "handler_timeout_seconds": handler_timeout_seconds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.pull_webhook_response_data_delivery_type_0 import PullWebhookResponseDataDeliveryType0
        d = dict(src_dict)
        def _parse_delivery(data: object) -> None | PullWebhookResponseDataDeliveryType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                delivery_type_0 = PullWebhookResponseDataDeliveryType0.from_dict(data)



                return delivery_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PullWebhookResponseDataDeliveryType0, data)

        delivery = _parse_delivery(d.pop("delivery"))


        backlog = d.pop("backlog")

        gap_count = d.pop("gap_count")

        def _parse_last_gap_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_gap_reason = _parse_last_gap_reason(d.pop("last_gap_reason"))


        retention_seconds = PullWebhookResponseDataRetentionSeconds(d.pop("retention_seconds"))




        handler_timeout_seconds = PullWebhookResponseDataHandlerTimeoutSeconds(d.pop("handler_timeout_seconds"))




        pull_webhook_response_data = cls(
            delivery=delivery,
            backlog=backlog,
            gap_count=gap_count,
            last_gap_reason=last_gap_reason,
            retention_seconds=retention_seconds,
            handler_timeout_seconds=handler_timeout_seconds,
        )

        return pull_webhook_response_data

