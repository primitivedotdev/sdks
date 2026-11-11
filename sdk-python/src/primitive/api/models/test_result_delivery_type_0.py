from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.test_result_delivery_type_0_reasons_item import TestResultDeliveryType0ReasonsItem





T = TypeVar("T", bound="TestResultDeliveryType0")



@_attrs_define
class TestResultDeliveryType0:
    """ Whether real email.received events would be sent to this endpoint, judged by the endpoint's own conditions as
    delivery judges them. Null when that could not be checked just now.

        Attributes:
            event_type (str): The event type checked.
            would_deliver (bool): Whether this endpoint's own conditions let the event through: it is on, it is not held,
                its owner can receive it, and it subscribes to the event type. Which endpoint routing or a rule grant sends a
                message to is decided separately, per message: POST /routes/simulate answers that, and a rule grant can deliver
                an email outside its owner's mailboxes. A Function endpoint is also judged at delivery on its Function's run
                state and key.
            reasons (list[TestResultDeliveryType0ReasonsItem]): Every reason it would not be sent the event, in the order
                delivery checks them; empty when it would. Codes, of which more may be added: disabled: the endpoint is off
                (disabled_reason on the endpoint says why). held: the endpoint, or the route the email came through, is held
                pending an owner or admin decision after its creator's access was reduced. acting_owner_revoked,
                acting_owner_suspended (which covers an expired key) and acting_owner_left: its owner cannot act now.
                acting_owner_permission: its owner does not read mail. acting_owner_depth: its owner sees headers only.
                acting_owner_scope: its owner does not read this email's mailbox, or, with no email to judge, reads no received
                mail at all now. These three name what the owner's access holds, so a caller who may not read API key metadata
                sees acting_owner_access in their place. event_type_not_subscribed: rules.event_types leaves the event out.
            events_paused_until (datetime.datetime | None): While repeated failures have paused this webhook (its circuit
                breaker is open): when webhook events other than mail (interaction, sent mail and credential events) are next
                attempted. Received mail is attempted regardless, so this does not change would_deliver. Null when nothing is
                paused, and for a Function endpoint.
     """

    event_type: str
    would_deliver: bool
    reasons: list[TestResultDeliveryType0ReasonsItem]
    events_paused_until: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_result_delivery_type_0_reasons_item import TestResultDeliveryType0ReasonsItem # noqa: PLC0415
        event_type = self.event_type

        would_deliver = self.would_deliver

        reasons = []
        for reasons_item_data in self.reasons:
            reasons_item = reasons_item_data.to_dict()
            reasons.append(reasons_item)



        events_paused_until: None | str
        if isinstance(self.events_paused_until, datetime.datetime):
            events_paused_until = self.events_paused_until.isoformat()
        else:
            events_paused_until = self.events_paused_until


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "event_type": event_type,
            "would_deliver": would_deliver,
            "reasons": reasons,
            "events_paused_until": events_paused_until,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_result_delivery_type_0_reasons_item import TestResultDeliveryType0ReasonsItem # noqa: PLC0415
        d = dict(src_dict)
        event_type = d.pop("event_type")

        would_deliver = d.pop("would_deliver")

        reasons = []
        _reasons = d.pop("reasons")
        for reasons_item_data in (_reasons):
            reasons_item = TestResultDeliveryType0ReasonsItem.from_dict(reasons_item_data)



            reasons.append(reasons_item)


        def _parse_events_paused_until(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                events_paused_until_type_0 = datetime.datetime.fromisoformat(data)



                return events_paused_until_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        events_paused_until = _parse_events_paused_until(d.pop("events_paused_until"))


        test_result_delivery_type_0 = cls(
            event_type=event_type,
            would_deliver=would_deliver,
            reasons=reasons,
            events_paused_until=events_paused_until,
        )


        test_result_delivery_type_0.additional_properties = d
        return test_result_delivery_type_0

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
