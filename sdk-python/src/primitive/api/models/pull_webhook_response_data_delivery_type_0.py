from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.pull_webhook_response_data_delivery_type_0_headers import PullWebhookResponseDataDeliveryType0Headers





T = TypeVar("T", bound="PullWebhookResponseDataDeliveryType0")



@_attrs_define
class PullWebhookResponseDataDeliveryType0:
    """ 
        Attributes:
            queue_id (UUID):
            event_id (UUID):
            event_type (str):
            delivery_id (UUID):
            lease_token (UUID):
            lease_expires_at (datetime.datetime):
            body (str):
            headers (PullWebhookResponseDataDeliveryType0Headers):
     """

    queue_id: UUID
    event_id: UUID
    event_type: str
    delivery_id: UUID
    lease_token: UUID
    lease_expires_at: datetime.datetime
    body: str
    headers: PullWebhookResponseDataDeliveryType0Headers





    def to_dict(self) -> dict[str, Any]:
        from ..models.pull_webhook_response_data_delivery_type_0_headers import PullWebhookResponseDataDeliveryType0Headers
        queue_id = str(self.queue_id)

        event_id = str(self.event_id)

        event_type = self.event_type

        delivery_id = str(self.delivery_id)

        lease_token = str(self.lease_token)

        lease_expires_at = self.lease_expires_at.isoformat()

        body = self.body

        headers = self.headers.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "queue_id": queue_id,
            "event_id": event_id,
            "event_type": event_type,
            "delivery_id": delivery_id,
            "lease_token": lease_token,
            "lease_expires_at": lease_expires_at,
            "body": body,
            "headers": headers,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.pull_webhook_response_data_delivery_type_0_headers import PullWebhookResponseDataDeliveryType0Headers
        d = dict(src_dict)
        queue_id = UUID(d.pop("queue_id"))




        event_id = UUID(d.pop("event_id"))




        event_type = d.pop("event_type")

        delivery_id = UUID(d.pop("delivery_id"))




        lease_token = UUID(d.pop("lease_token"))




        lease_expires_at = isoparse(d.pop("lease_expires_at"))




        body = d.pop("body")

        headers = PullWebhookResponseDataDeliveryType0Headers.from_dict(d.pop("headers"))




        pull_webhook_response_data_delivery_type_0 = cls(
            queue_id=queue_id,
            event_id=event_id,
            event_type=event_type,
            delivery_id=delivery_id,
            lease_token=lease_token,
            lease_expires_at=lease_expires_at,
            body=body,
            headers=headers,
        )

        return pull_webhook_response_data_delivery_type_0

